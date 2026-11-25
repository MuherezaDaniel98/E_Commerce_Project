import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import express from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  auditLogs,
  categories,
  inventory,
  inventoryMovements,
  notifications,
  orderItems,
  orders,
  payments,
  products,
  receipts,
  storeSettings,
  users,
} from '../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from './auth.ts';
import { formatUgx } from './orders.ts';

export const adminRouter = express.Router();

// All admin/staff routes require verified auth + staff/admin role
adminRouter.use(requireAuth, requireRole(['admin', 'staff']));

// BI Analytics Dashboard Data (KPIs + 7 Real PostgreSQL Charts)
adminRouter.get('/analytics', async (req, res, next) => {
  try {
    const days = Math.min(365, Math.max(7, Number(req.query.days || 30)));
    const now = new Date();
    const startCurrent = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startPrev = new Date(startCurrent.getTime() - days * 24 * 60 * 60 * 1000);

    const [
      allOrders,
      allOrderItems,
      allCustomers,
      allProductsWithInv,
      allCategories,
      allPayments,
    ] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(orderItems),
      db.select().from(users).where(eq(users.role, 'customer')),
      db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          categoryId: products.categoryId,
          priceUgx: products.priceUgx,
          discountPriceUgx: products.discountPriceUgx,
          isActive: products.isActive,
          quantityOnHand: inventory.quantityOnHand,
          lowStockThreshold: inventory.lowStockThreshold,
        })
        .from(products)
        .innerJoin(inventory, eq(products.id, inventory.productId)),
      db.select().from(categories),
      db.select().from(payments),
    ]);

    const currentOrders = allOrders.filter((o) => new Date(o.createdAt) >= startCurrent);
    const prevOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= startPrev && new Date(o.createdAt) < startCurrent
    );

    const calcPct = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    const currentRevenue = currentOrders
      .filter((o) => o.paymentStatus === 'paid' && o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.totalUgx, 0);
    const prevRevenue = prevOrders
      .filter((o) => o.paymentStatus === 'paid' && o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.totalUgx, 0);

    const currentOrderIds = new Set(currentOrders.map((o) => o.id));
    const prevOrderIds = new Set(prevOrders.map((o) => o.id));

    const currentSalesUnits = allOrderItems
      .filter((i) => currentOrderIds.has(i.orderId))
      .reduce((sum, i) => sum + i.quantity, 0);
    const prevSalesUnits = allOrderItems
      .filter((i) => prevOrderIds.has(i.orderId))
      .reduce((sum, i) => sum + i.quantity, 0);

    const lowStockItems = allProductsWithInv.filter(
      (p) => p.isActive && p.quantityOnHand > 0 && p.quantityOnHand <= p.lowStockThreshold
    );
    const outOfStockItems = allProductsWithInv.filter((p) => p.isActive && p.quantityOnHand === 0);
    const inStockItems = allProductsWithInv.filter(
      (p) => p.isActive && p.quantityOnHand > p.lowStockThreshold
    );

    const pendingOrdersCount = allOrders.filter((o) => o.status === 'Pending').length;
    const completedOrdersCount = allOrders.filter((o) => o.status === 'Delivered').length;

    const kpis = {
      totalRevenueUgx: currentRevenue,
      revenueChangePct: calcPct(currentRevenue, prevRevenue),
      totalOrders: currentOrders.length,
      ordersChangePct: calcPct(currentOrders.length, prevOrders.length),
      totalSalesUnits: currentSalesUnits,
      salesUnitsChangePct: calcPct(currentSalesUnits, prevSalesUnits),
      totalCustomers: allCustomers.length,
      newCustomersInPeriod: allCustomers.filter((c) => new Date(c.createdAt) >= startCurrent).length,
      totalProducts: allProductsWithInv.filter((p) => p.isActive).length,
      lowStockProducts: lowStockItems.length + outOfStockItems.length,
      pendingOrders: pendingOrdersCount,
      completedOrders: completedOrdersCount,
    };

    // 1. Sales performance line chart (bucketed by day or date label)
    const dayBuckets = new Map<string, { date: string; revenueUgx: number; orders: number; units: number }>();
    for (let d = days - 1; d >= 0; d--) {
      const dt = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const key = dt.toISOString().slice(0, 10);
      dayBuckets.set(key, {
        date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenueUgx: 0,
        orders: 0,
        units: 0,
      });
    }

    const orderItemUnitsMap = new Map<number, number>();
    for (const item of allOrderItems) {
      orderItemUnitsMap.set(item.orderId, (orderItemUnitsMap.get(item.orderId) || 0) + item.quantity);
    }

    for (const o of currentOrders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const bucket = dayBuckets.get(key);
      if (bucket) {
        bucket.orders += 1;
        bucket.units += orderItemUnitsMap.get(o.id) || 0;
        if (o.paymentStatus === 'paid' && o.status !== 'Cancelled') {
          bucket.revenueUgx += o.totalUgx;
        }
      }
    }
    const salesPerformance = Array.from(dayBuckets.values());

    // 2. Revenue bar chart (weekly buckets across period)
    const weekBuckets = new Map<string, { period: string; paidRevenueUgx: number; pendingValueUgx: number }>();
    for (const o of currentOrders) {
      const dt = new Date(o.createdAt);
      const weekNum = Math.max(
        1,
        Math.ceil((now.getTime() - dt.getTime()) / (7 * 24 * 60 * 60 * 1000))
      );
      const label = weekNum === 1 ? 'This Week' : `${weekNum - 1}w Ago`;
      if (!weekBuckets.has(label)) {
        weekBuckets.set(label, { period: label, paidRevenueUgx: 0, pendingValueUgx: 0 });
      }
      const b = weekBuckets.get(label)!;
      if (o.paymentStatus === 'paid' && o.status !== 'Cancelled') {
        b.paidRevenueUgx += o.totalUgx;
      } else if (o.status !== 'Cancelled') {
        b.pendingValueUgx += o.totalUgx;
      }
    }
    const revenueByPeriod = Array.from(weekBuckets.values()).reverse();

    // 3. Order status doughnut chart
    const statusMap = new Map<string, number>();
    for (const o of currentOrders) {
      statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
    }
    const orderStatusBreakdown = Array.from(statusMap.entries()).map(([status, value]) => ({
      name: status,
      value,
    }));

    // 4. Product category pie chart
    const catNameById = new Map(allCategories.map((c) => [c.id, c.name]));
    const prodCatById = new Map(allProductsWithInv.map((p) => [p.id, catNameById.get(p.categoryId) || 'Other']));
    const catRevMap = new Map<string, { name: string; revenueUgx: number; units: number }>();

    for (const item of allOrderItems) {
      if (!currentOrderIds.has(item.orderId)) continue;
      const catName = prodCatById.get(item.productId) || 'Other';
      if (!catRevMap.has(catName)) {
        catRevMap.set(catName, { name: catName, revenueUgx: 0, units: 0 });
      }
      const c = catRevMap.get(catName)!;
      c.revenueUgx += item.lineTotalUgx;
      c.units += item.quantity;
    }
    const categoryRevenue = Array.from(catRevMap.values()).sort((a, b) => b.revenueUgx - a.revenueUgx);

    // 5. Top-selling products chart
    const prodStats = new Map<number, { name: string; sku: string; unitsSold: number; revenueUgx: number }>();
    for (const item of allOrderItems) {
      if (!currentOrderIds.has(item.orderId)) continue;
      if (!prodStats.has(item.productId)) {
        prodStats.set(item.productId, {
          name: item.productName,
          sku: item.productSku,
          unitsSold: 0,
          revenueUgx: 0,
        });
      }
      const p = prodStats.get(item.productId)!;
      p.unitsSold += item.quantity;
      p.revenueUgx += item.lineTotalUgx;
    }
    const topSellingProducts = Array.from(prodStats.values())
      .sort((a, b) => b.revenueUgx - a.revenueUgx)
      .slice(0, 6);

    // 6. Inventory analytics
    const inventoryAnalytics = {
      summary: [
        { status: 'Healthy Stock', count: inStockItems.length },
        { status: 'Low Stock', count: lowStockItems.length },
        { status: 'Out of Stock', count: outOfStockItems.length },
      ],
      alerts: [...outOfStockItems, ...lowStockItems].slice(0, 10),
    };

    // 7. Customer analytics (New vs Returning)
    const ordersPerEmail = new Map<string, number>();
    for (const o of allOrders) {
      ordersPerEmail.set(o.customerEmail, (ordersPerEmail.get(o.customerEmail) || 0) + 1);
    }
    let newBuyerCount = 0;
    let returningBuyerCount = 0;
    const seenInPeriod = new Set<string>();
    for (const o of currentOrders) {
      if (seenInPeriod.has(o.customerEmail)) continue;
      seenInPeriod.add(o.customerEmail);
      if ((ordersPerEmail.get(o.customerEmail) || 0) > 1) {
        returningBuyerCount += 1;
      } else {
        newBuyerCount += 1;
      }
    }

    const paymentMethodMap = new Map<string, number>();
    for (const p of allPayments) {
      if (p.status === 'paid') {
        paymentMethodMap.set(p.method, (paymentMethodMap.get(p.method) || 0) + p.amountUgx);
      }
    }

    const customerAnalytics = {
      segments: [
        { name: 'Returning Shoppers', count: returningBuyerCount },
        { name: 'First-Time Shoppers', count: newBuyerCount },
      ],
      paymentMethods: Array.from(paymentMethodMap.entries()).map(([method, amountUgx]) => ({
        method,
        amountUgx,
      })),
    };

    res.json({
      days,
      kpis,
      charts: {
        salesPerformance,
        revenueByPeriod,
        orderStatusBreakdown,
        categoryRevenue,
        topSellingProducts,
        inventoryAnalytics,
        customerAnalytics,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Admin Orders Management
adminRouter.get('/orders', async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();

    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const filtered = allOrders.filter((o) => {
      if (status && status !== 'all' && o.status !== status) return false;
      if (
        search &&
        !o.orderNumber.toLowerCase().includes(search) &&
        !o.customerName.toLowerCase().includes(search) &&
        !o.customerEmail.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    const [itemsRows, paymentRows, receiptRows] = await Promise.all([
      db.select().from(orderItems),
      db.select().from(payments),
      db.select().from(receipts),
    ]);

    res.json({
      orders: filtered.map((o) => ({
        ...o,
        items: itemsRows.filter((i) => i.orderId === o.id),
        payments: paymentRows.filter((p) => p.orderId === o.id),
        receipt: receiptRows.find((r) => r.orderId === o.id) || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const statusUpdateSchema = z.object({
  status: z.enum([
    'Pending',
    'Confirmed',
    'Processing',
    'Ready for collection',
    'Out for delivery',
    'Delivered',
    'Cancelled',
  ]),
});

adminRouter.patch('/orders/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = statusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid order status.' });
    }

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(orders).where(eq(orders.id, id));
      if (!existing) {
        throw Object.assign(new Error('Order not found.'), { status: 404 });
      }

      // Restore stock if cancelling a non-cancelled order
      if (parsed.data.status === 'Cancelled' && existing.status !== 'Cancelled') {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
        for (const item of items) {
          const [inv] = await tx
            .update(inventory)
            .set({
              quantityOnHand: sql`${inventory.quantityOnHand} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(inventory.productId, item.productId))
            .returning();

          if (inv) {
            await tx.insert(inventoryMovements).values({
              productId: item.productId,
              actorUserId: req.authUser!.id,
              movementType: 'return',
              quantityDelta: item.quantity,
              balanceAfter: inv.quantityOnHand,
              referenceType: 'order_cancelled',
              referenceId: id,
              note: `Stock restored on cancellation of ${existing.orderNumber}`,
            });
          }
        }
      }

      const [nextOrder] = await tx
        .update(orders)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning();

      await tx.insert(auditLogs).values({
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'ORDER_STATUS_UPDATED',
        entityType: 'order',
        entityId: String(id),
        details: { orderNumber: existing.orderNumber, from: existing.status, to: parsed.data.status },
      });

      return nextOrder;
    });

    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
});

// Inventory Monitoring & Stock Adjustments
adminRouter.get('/inventory', async (_req, res, next) => {
  try {
    const [items, movements] = await Promise.all([
      db
        .select({
          productId: products.id,
          sku: products.sku,
          name: products.name,
          categoryName: categories.name,
          priceUgx: products.priceUgx,
          isActive: products.isActive,
          quantityOnHand: inventory.quantityOnHand,
          lowStockThreshold: inventory.lowStockThreshold,
          updatedAt: inventory.updatedAt,
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .innerJoin(inventory, eq(products.id, inventory.productId))
        .orderBy(inventory.quantityOnHand),
      db
        .select({
          id: inventoryMovements.id,
          productId: inventoryMovements.productId,
          productName: products.name,
          sku: products.sku,
          movementType: inventoryMovements.movementType,
          quantityDelta: inventoryMovements.quantityDelta,
          balanceAfter: inventoryMovements.balanceAfter,
          note: inventoryMovements.note,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .innerJoin(products, eq(inventoryMovements.productId, products.id))
        .orderBy(desc(inventoryMovements.createdAt))
        .limit(40),
    ]);

    res.json({ items, movements });
  } catch (err) {
    next(err);
  }
});

const adjustSchema = z.object({
  productId: z.number().int().positive(),
  quantityDelta: z.number().int().refine((n) => n !== 0, 'Adjustment delta cannot be 0'),
  movementType: z.enum(['restock', 'adjustment', 'return']),
  lowStockThreshold: z.number().int().min(0).optional(),
  note: z.string().trim().min(2).max(200),
});

adminRouter.post('/inventory/adjust', async (req: AuthRequest, res, next) => {
  try {
    const parsed = adjustSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid stock adjustment' });
    }
    const d = parsed.data;

    const updated = await db.transaction(async (tx) => {
      const [inv] = await tx.select().from(inventory).where(eq(inventory.productId, d.productId));
      if (!inv) {
        throw Object.assign(new Error('Inventory record not found.'), { status: 404 });
      }
      const nextQty = inv.quantityOnHand + d.quantityDelta;
      if (nextQty < 0) {
        throw Object.assign(new Error('Stock quantity cannot go below zero.'), { status: 400 });
      }

      const [nextInv] = await tx
        .update(inventory)
        .set({
          quantityOnHand: nextQty,
          lowStockThreshold: d.lowStockThreshold ?? inv.lowStockThreshold,
          updatedAt: new Date(),
        })
        .where(eq(inventory.productId, d.productId))
        .returning();

      await tx.insert(inventoryMovements).values({
        productId: d.productId,
        actorUserId: req.authUser!.id,
        movementType: d.movementType,
        quantityDelta: d.quantityDelta,
        balanceAfter: nextQty,
        referenceType: 'admin_adjustment',
        note: d.note,
      });

      return nextInv;
    });

    res.json({ inventory: updated });
  } catch (err) {
    next(err);
  }
});

// Customers & Users Management (Admin only for role/status updates)
adminRouter.get('/users', async (_req, res, next) => {
  try {
    const [allUsers, orderStats] = await Promise.all([
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt)),
      db
        .select({
          customerEmail: orders.customerEmail,
          orderCount: count(),
          totalSpentUgx: sql<number>`COALESCE(SUM(${orders.totalUgx}), 0)`,
        })
        .from(orders)
        .groupBy(orders.customerEmail),
    ]);

    const statMap = new Map(orderStats.map((s) => [s.customerEmail.toLowerCase(), s]));

    res.json({
      users: allUsers.map((u) => {
        const st = statMap.get(u.email.toLowerCase());
        return {
          ...u,
          orderCount: Number(st?.orderCount || 0),
          totalSpentUgx: Number(st?.totalSpentUgx || 0),
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

const userUpdateSchema = z.object({
  role: z.enum(['customer', 'staff', 'admin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

adminRouter.patch(
  '/users/:id',
  requireRole(['admin']),
  async (req: AuthRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      const parsed = userUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid user update payload.' });
      }
      if (id === req.authUser!.id && parsed.data.status === 'suspended') {
        return res.status(400).json({ error: 'You cannot suspend your own active admin account.' });
      }

      const [updated] = await db
        .update(users)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          role: users.role,
          status: users.status,
        });

      if (!updated) return res.status(404).json({ error: 'User not found.' });

      await db.insert(auditLogs).values({
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'USER_ACCOUNT_UPDATED',
        entityType: 'user',
        entityId: String(id),
        details: parsed.data,
      });

      res.json({ user: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Store settings (COD toggle, announcement banner, free delivery threshold)
adminRouter.get('/settings', async (_req, res, next) => {
  try {
    const rows = await db.select().from(storeSettings);
    res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/settings', requireRole(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const entries = Object.entries(req.body || {}).filter(
      ([k, v]) => typeof k === 'string' && typeof v === 'string'
    ) as Array<[string, string]>;

    for (const [key, value] of entries) {
      await db
        .insert(storeSettings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: storeSettings.key,
          set: { value, updatedAt: new Date() },
        });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Notifications & Audit Logs
adminRouter.get('/notifications', async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.roleTarget, 'admin'))
      .orderBy(desc(notifications.createdAt))
      .limit(25);
    res.json({ notifications: rows });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, Number(req.params.id)), eq(notifications.roleTarget, 'admin')));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/audit-logs', requireRole(['admin']), async (_req, res, next) => {
  try {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50);
    res.json({ logs: rows });
  } catch (err) {
    next(err);
  }
});

// Downloadable Reports (CSV & PDF)
adminRouter.get('/reports/export', requireRole(['admin']), async (req, res, next) => {
  try {
    const type = String(req.query.type || 'sales');
    const format = String(req.query.format || 'csv');
    const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let title = 'Sales Report';
    let headers: string[] = [];
    let rows: Array<Array<string | number>> = [];

    if (type === 'sales' || type === 'orders') {
      title = type === 'sales' ? `Sales Revenue Report (Last ${days} Days)` : `Orders Report (Last ${days} Days)`;
      const data = await db
        .select()
        .from(orders)
        .where(gte(orders.createdAt, cutoff))
        .orderBy(desc(orders.createdAt));
      headers = ['Order No', 'Date', 'Customer', 'Method', 'Status', 'Payment', 'Total (UGX)'];
      rows = data.map((o) => [
        o.orderNumber,
        new Date(o.createdAt).toISOString().slice(0, 10),
        o.customerName,
        o.fulfillmentMethod,
        o.status,
        o.paymentStatus,
        o.totalUgx,
      ]);
    } else if (type === 'inventory' || type === 'products') {
      title = type === 'inventory' ? 'Inventory Stock & Threshold Report' : 'Product Catalogue Report';
      const data = await db
        .select({
          sku: products.sku,
          name: products.name,
          category: categories.name,
          priceUgx: products.priceUgx,
          discountUgx: products.discountPriceUgx,
          stock: inventory.quantityOnHand,
          threshold: inventory.lowStockThreshold,
          active: products.isActive,
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .innerJoin(inventory, eq(products.id, inventory.productId));
      headers = ['SKU', 'Product', 'Category', 'Price (UGX)', 'Stock', 'Threshold', 'Active'];
      rows = data.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.discountUgx ?? p.priceUgx,
        p.stock,
        p.threshold,
        p.active ? 'Yes' : 'No',
      ]);
    } else if (type === 'customers') {
      title = 'Registered Customers Report';
      const data = await db.select().from(users).where(eq(users.role, 'customer'));
      headers = ['ID', 'Full Name', 'Email', 'Phone', 'Status', 'Joined'];
      rows = data.map((u) => [
        u.id,
        u.fullName,
        u.email,
        u.phone,
        u.status,
        new Date(u.createdAt).toISOString().slice(0, 10),
      ]);
    } else {
      title = `Payment Transactions Report (Last ${days} Days)`;
      const data = await db
        .select()
        .from(payments)
        .where(gte(payments.createdAt, cutoff))
        .orderBy(desc(payments.createdAt));
      headers = ['Tx Ref', 'Order ID', 'Method', 'Status', 'Amount (UGX)', 'Date'];
      rows = data.map((p) => [
        p.transactionRef,
        p.orderId,
        p.method,
        p.status,
        p.amountUgx,
        new Date(p.createdAt).toISOString().slice(0, 10),
      ]);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="marketsphere-${type}-report.pdf"`);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      doc.pipe(res);

      doc.rect(0, 0, doc.page.width, 76).fill('#123B70');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text('MarketSphere — Active Supermarket Kabale', 40, 22);
      doc.fillColor('#BAE6FD').font('Helvetica').fontSize(10).text(`${title} · Generated ${new Date().toLocaleString('en-UG')}`, 40, 46);

      let y = 98;
      doc.fillColor('#123B70').font('Helvetica-Bold').fontSize(8.5);
      const colWidth = Math.floor(515 / headers.length);
      headers.forEach((h, i) => {
        doc.text(h, 40 + i * colWidth, y, { width: colWidth - 4 });
      });

      y += 18;
      doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor('#CBD5E1').stroke();
      doc.font('Helvetica').fontSize(8).fillColor('#172B4D');

      for (const r of rows.slice(0, 35)) {
        if (y > 760) {
          doc.addPage();
          y = 48;
        }
        r.forEach((cell, i) => {
          doc.text(String(cell), 40 + i * colWidth, y, { width: colWidth - 4 });
        });
        y += 18;
      }

      if (type === 'sales') {
        const totalPaid = rows
          .filter((r) => r[5] === 'paid' && r[4] !== 'Cancelled')
          .reduce((s, r) => s + Number(r[6] || 0), 0);
        doc
          .moveDown(2)
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#123B70')
          .text(`Total Confirmed Sales Revenue: ${formatUgx(totalPaid)}`, 40, y + 16);
      }

      doc.end();
      return;
    }

    const csvEscape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csvBody = [
      headers.map(csvEscape).join(','),
      ...rows.map((r) => r.map(csvEscape).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="marketsphere-${type}-report.csv"`);
    res.send(csvBody);
  } catch (err) {
    next(err);
  }
});
