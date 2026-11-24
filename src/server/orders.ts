import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import express from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  auditLogs,
  deliveryAddresses,
  deliveryLocations,
  inventory,
  inventoryMovements,
  notifications,
  orderItems,
  orders,
  payments,
  products,
  receipts,
  storeSettings,
  wishlists,
} from '../db/schema.ts';
import { type AuthRequest, optionalAuth, requireAuth } from './auth.ts';

export const ordersRouter = express.Router();

export function formatUgx(amount: number): string {
  return `UGX ${Number(amount || 0).toLocaleString('en-US')}`;
}

// Public delivery & collection locations + store checkout rules
ordersRouter.get('/delivery-locations', async (_req, res, next) => {
  try {
    const [locations, settingsRows] = await Promise.all([
      db.select().from(deliveryLocations).where(eq(deliveryLocations.isActive, true)),
      db.select().from(storeSettings),
    ]);
    const settings = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));
    res.json({
      locations,
      codEnabled: settings.cod_enabled !== 'false',
      freeDeliveryThresholdUgx: Number(settings.free_delivery_threshold_ugx || 150000),
    });
  } catch (err) {
    next(err);
  }
});

// Wishlist (Auth required)
ordersRouter.get('/wishlist', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const rows = await db
      .select({
        wishlistId: wishlists.id,
        productId: products.id,
        name: products.name,
        slug: products.slug,
        sku: products.sku,
        priceUgx: products.priceUgx,
        discountPriceUgx: products.discountPriceUgx,
        imageUrl: products.imageUrl,
        ratingAvg: products.ratingAvg,
        quantityOnHand: inventory.quantityOnHand,
      })
      .from(wishlists)
      .innerJoin(products, eq(wishlists.productId, products.id))
      .innerJoin(inventory, eq(products.id, inventory.productId))
      .where(eq(wishlists.userId, req.authUser!.id))
      .orderBy(desc(wishlists.createdAt));

    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

ordersRouter.post('/wishlist/toggle', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.body?.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Valid productId is required.' });
    }

    const [existing] = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, req.authUser!.id), eq(wishlists.productId, productId)));

    if (existing) {
      await db.delete(wishlists).where(eq(wishlists.id, existing.id));
      return res.json({ wishlisted: false });
    }

    await db.insert(wishlists).values({ userId: req.authUser!.id, productId });
    res.json({ wishlisted: true });
  } catch (err) {
    next(err);
  }
});

// Saved Delivery Addresses (Auth required)
ordersRouter.get('/addresses', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const rows = await db
      .select()
      .from(deliveryAddresses)
      .where(eq(deliveryAddresses.userId, req.authUser!.id))
      .orderBy(desc(deliveryAddresses.isDefault), desc(deliveryAddresses.createdAt));
    res.json({ addresses: rows });
  } catch (err) {
    next(err);
  }
});

const addressSchema = z.object({
  label: z.string().trim().min(2).max(60),
  recipientName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  locationId: z.number().int().positive().nullable().optional(),
  streetDetails: z.string().trim().min(3).max(200),
  landmark: z.string().trim().max(160).default(''),
  isDefault: z.boolean().default(false),
});

ordersRouter.post('/addresses', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid address' });
    }

    if (parsed.data.isDefault) {
      await db
        .update(deliveryAddresses)
        .set({ isDefault: false })
        .where(eq(deliveryAddresses.userId, req.authUser!.id));
    }

    const [created] = await db
      .insert(deliveryAddresses)
      .values({
        userId: req.authUser!.id,
        label: parsed.data.label,
        recipientName: parsed.data.recipientName,
        phone: parsed.data.phone,
        locationId: parsed.data.locationId ?? null,
        streetDetails: parsed.data.streetDetails,
        landmark: parsed.data.landmark,
        isDefault: parsed.data.isDefault,
      })
      .returning();

    res.status(201).json({ address: created });
  } catch (err) {
    next(err);
  }
});

ordersRouter.delete('/addresses/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(deliveryAddresses)
      .where(and(eq(deliveryAddresses.id, id), eq(deliveryAddresses.userId, req.authUser!.id)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Validate cart stock before checkout
ordersRouter.post('/cart/validate', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const productIds = items.map((i: { productId: number }) => Number(i.productId)).filter(Boolean);
    const dbProducts = await db
      .select({
        id: products.id,
        name: products.name,
        priceUgx: products.priceUgx,
        discountPriceUgx: products.discountPriceUgx,
        isActive: products.isActive,
        quantityOnHand: inventory.quantityOnHand,
      })
      .from(products)
      .innerJoin(inventory, eq(products.id, inventory.productId))
      .where(inArray(products.id, productIds));

    const prodMap = new Map(dbProducts.map((p) => [p.id, p]));
    const issues: string[] = [];

    for (const item of items) {
      const p = prodMap.get(Number(item.productId));
      const qty = Number(item.quantity || 0);
      if (!p || !p.isActive) {
        issues.push(`Product #${item.productId} is no longer available.`);
      } else if (qty <= 0) {
        issues.push(`Invalid quantity for ${p.name}.`);
      } else if (p.quantityOnHand < qty) {
        issues.push(`Insufficient stock for ${p.name} (available: ${p.quantityOnHand}).`);
      }
    }

    res.json({ valid: issues.length === 0, issues });
  } catch (err) {
    next(err);
  }
});

// Create Order inside atomic PostgreSQL transaction
const createOrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Customer name is required').max(120),
  customerEmail: z.string().trim().email('Valid email is required').max(160),
  customerPhone: z.string().trim().min(7, 'Phone number is required').max(30),
  fulfillmentMethod: z.enum(['delivery', 'collection']),
  deliveryLocationId: z.number().int().positive(),
  deliveryAddressText: z.string().trim().max(300).default(''),
  deliveryNotes: z.string().trim().max(400).default(''),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().max(100),
      })
    )
    .min(1, 'At least one item is required'),
});

ordersRouter.post('/orders', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid order details' });
    }
    const d = parsed.data;

    if (d.fulfillmentMethod === 'delivery' && d.deliveryAddressText.trim().length < 4) {
      return res.status(400).json({ error: 'Please provide your street/plot delivery details.' });
    }

    const created = await db.transaction(async (tx) => {
      const [location] = await tx
        .select()
        .from(deliveryLocations)
        .where(eq(deliveryLocations.id, d.deliveryLocationId));
      if (!location || !location.isActive) {
        throw Object.assign(new Error('Selected delivery or collection location is unavailable.'), {
          status: 400,
        });
      }

      const [thresholdRow] = await tx
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.key, 'free_delivery_threshold_ugx'));
      const freeThreshold = Number(thresholdRow?.value || 150000);

      let subtotalUgx = 0;
      const lineItems: Array<{
        productId: number;
        productName: string;
        productSku: string;
        unitPriceUgx: number;
        quantity: number;
        lineTotalUgx: number;
        newBalance: number;
      }> = [];

      for (const reqItem of d.items) {
        const [prod] = await tx
          .select({
            id: products.id,
            name: products.name,
            sku: products.sku,
            priceUgx: products.priceUgx,
            discountPriceUgx: products.discountPriceUgx,
            isActive: products.isActive,
          })
          .from(products)
          .where(eq(products.id, reqItem.productId));

        if (!prod || !prod.isActive) {
          throw Object.assign(new Error(`Product #${reqItem.productId} is unavailable.`), { status: 400 });
        }

        // Atomic conditional stock decrement to prevent overselling
        const [updatedInv] = await tx
          .update(inventory)
          .set({
            quantityOnHand: sql`${inventory.quantityOnHand} - ${reqItem.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(inventory.productId, reqItem.productId),
              sql`${inventory.quantityOnHand} >= ${reqItem.quantity}`
            )
          )
          .returning();

        if (!updatedInv) {
          throw Object.assign(
            new Error(`Insufficient stock for ${prod.name}. Please adjust quantity in cart.`),
            { status: 409 }
          );
        }

        const unitPrice = prod.discountPriceUgx ?? prod.priceUgx;
        const lineTotal = unitPrice * reqItem.quantity;
        subtotalUgx += lineTotal;

        lineItems.push({
          productId: prod.id,
          productName: prod.name,
          productSku: prod.sku,
          unitPriceUgx: unitPrice,
          quantity: reqItem.quantity,
          lineTotalUgx: lineTotal,
          newBalance: updatedInv.quantityOnHand,
        });
      }

      const deliveryFeeUgx =
        d.fulfillmentMethod === 'collection' || subtotalUgx >= freeThreshold ? 0 : location.feeUgx;
      const totalUgx = subtotalUgx + deliveryFeeUgx;
      const orderNumber = `MS-KBL-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: req.authUser?.id ?? null,
          customerName: d.customerName,
          customerEmail: d.customerEmail.toLowerCase(),
          customerPhone: d.customerPhone,
          fulfillmentMethod: d.fulfillmentMethod,
          deliveryLocationId: location.id,
          deliveryLocationName: location.name,
          deliveryAddressText:
            d.fulfillmentMethod === 'collection'
              ? 'Store Counter Pickup — Active Supermarket Kabale'
              : d.deliveryAddressText,
          deliveryNotes: d.deliveryNotes,
          subtotalUgx,
          deliveryFeeUgx,
          totalUgx,
          status: 'Pending',
          paymentStatus: 'pending',
        })
        .returning();

      await tx.insert(orderItems).values(
        lineItems.map((li) => ({
          orderId: order.id,
          productId: li.productId,
          productName: li.productName,
          productSku: li.productSku,
          unitPriceUgx: li.unitPriceUgx,
          quantity: li.quantity,
          lineTotalUgx: li.lineTotalUgx,
        }))
      );

      for (const li of lineItems) {
        await tx.insert(inventoryMovements).values({
          productId: li.productId,
          actorUserId: req.authUser?.id ?? null,
          movementType: 'sale',
          quantityDelta: -li.quantity,
          balanceAfter: li.newBalance,
          referenceType: 'order',
          referenceId: order.id,
          note: `Order ${orderNumber}`,
        });
      }

      await tx.insert(notifications).values({
        roleTarget: 'admin',
        title: `New Order ${orderNumber}`,
        message: `${d.customerName} placed an order totaling ${formatUgx(totalUgx)}.`,
      });

      return { order, items: lineItems };
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Simulated Payment Processing (Academic Prototype — never requests real PIN/OTP/CVV)
const simulatePaymentSchema = z.object({
  orderId: z.number().int().positive(),
  method: z.enum(['mtn_momo', 'airtel_money', 'card_demo', 'cash_on_delivery']),
  outcome: z.enum(['success', 'pending', 'failed']).default('success'),
  simulatedPhoneOrCardHint: z.string().trim().max(40).default(''),
});

ordersRouter.post('/payments/simulate', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = simulatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payment payload' });
    }
    const d = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, d.orderId));
      if (!order) {
        throw Object.assign(new Error('Order not found.'), { status: 404 });
      }

      // Check COD setting
      if (d.method === 'cash_on_delivery') {
        const [codRow] = await tx
          .select()
          .from(storeSettings)
          .where(eq(storeSettings.key, 'cod_enabled'));
        if (codRow?.value === 'false') {
          throw Object.assign(new Error('Cash on delivery is currently disabled by store admin.'), {
            status: 400,
          });
        }
      }

      const txRef = `SIM-${d.method.toUpperCase().slice(0, 4)}-${Date.now().toString().slice(-6)}`;
      const effectiveStatus =
        d.method === 'cash_on_delivery' && d.outcome === 'success'
          ? 'pending'
          : d.outcome === 'success'
          ? 'paid'
          : d.outcome;

      const mask =
        d.method === 'card_demo'
          ? `Demo Card •••• ${d.simulatedPhoneOrCardHint.slice(-4) || '4242'}`
          : d.simulatedPhoneOrCardHint || order.customerPhone;

      const [payment] = await tx
        .insert(payments)
        .values({
          orderId: order.id,
          method: d.method,
          transactionRef: txRef,
          amountUgx: order.totalUgx,
          status: effectiveStatus,
          simulatedAccountMask: mask,
          failureReason:
            effectiveStatus === 'failed'
              ? 'Simulated payment declined (test scenario: insufficient funds / timeout).'
              : null,
          paidAt: effectiveStatus === 'paid' ? new Date() : null,
        })
        .returning();

      const nextOrderStatus =
        effectiveStatus === 'paid'
          ? 'Confirmed'
          : d.method === 'cash_on_delivery'
          ? 'Confirmed'
          : order.status;

      const [updatedOrder] = await tx
        .update(orders)
        .set({
          paymentStatus: effectiveStatus,
          status: nextOrderStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))
        .returning();

      let receipt: typeof receipts.$inferSelect | null = null;

      // STRICT RULE: Never generate a receipt claiming success when status is failed or pending!
      if (effectiveStatus === 'paid') {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        const receiptNumber = `RCP-ASK-${Date.now().toString().slice(-6)}`;
        const [existingReceipt] = await tx
          .select()
          .from(receipts)
          .where(eq(receipts.orderId, order.id));

        if (!existingReceipt) {
          const [createdReceipt] = await tx
            .insert(receipts)
            .values({
              receiptNumber,
              orderId: order.id,
              paymentId: payment.id,
              issuedAt: new Date(),
              snapshotJson: {
                receiptNumber,
                orderNumber: order.orderNumber,
                organisation: 'Active Supermarket Kabale',
                systemName: 'MarketSphere',
                customerName: order.customerName,
                customerEmail: order.customerEmail,
                customerPhone: order.customerPhone,
                fulfillmentMethod: order.fulfillmentMethod,
                deliveryLocationName: order.deliveryLocationName,
                deliveryAddressText: order.deliveryAddressText,
                items,
                subtotalUgx: order.subtotalUgx,
                deliveryFeeUgx: order.deliveryFeeUgx,
                totalUgx: order.totalUgx,
                paymentMethod: d.method,
                transactionRef: txRef,
                simulatedAccountMask: mask,
                paymentStatus: 'paid',
                issuedAt: new Date().toISOString(),
              },
            })
            .returning();
          receipt = createdReceipt;
        } else {
          receipt = existingReceipt;
        }
      }

      await tx.insert(auditLogs).values({
        actorUserId: req.authUser?.id ?? null,
        actorEmail: req.authUser?.email ?? order.customerEmail,
        action: `PAYMENT_SIMULATED_${effectiveStatus.toUpperCase()}`,
        entityType: 'payment',
        entityId: String(payment.id),
        details: { orderNumber: order.orderNumber, method: d.method, txRef },
      });

      return { order: updatedOrder, payment, receipt };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Authenticated customer's own orders
ordersRouter.get('/orders/my', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userOrders = await db
      .select()
      .from(orders)
      .where(
        sql`${orders.userId} = ${req.authUser!.id} OR LOWER(${orders.customerEmail}) = LOWER(${req.authUser!.email})`
      )
      .orderBy(desc(orders.createdAt));

    const orderIds = userOrders.map((o) => o.id);
    if (orderIds.length === 0) {
      return res.json({ orders: [] });
    }

    const [itemsRows, paymentRows, receiptRows] = await Promise.all([
      db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
      db.select().from(payments).where(inArray(payments.orderId, orderIds)),
      db.select().from(receipts).where(inArray(receipts.orderId, orderIds)),
    ]);

    const enriched = userOrders.map((o) => ({
      ...o,
      items: itemsRows.filter((i) => i.orderId === o.id),
      payments: paymentRows.filter((p) => p.orderId === o.id),
      receipt: receiptRows.find((r) => r.orderId === o.id) || null,
    }));

    res.json({ orders: enriched });
  } catch (err) {
    next(err);
  }
});

// Order tracking by order number (supports customer order tracking view)
ordersRouter.get('/orders/track/:orderNumber', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const orderNumber = req.params.orderNumber.trim().toUpperCase();
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    if (!order) {
      return res.status(404).json({ error: `No order found with reference ${orderNumber}.` });
    }

    const [items, orderPayments, [receipt]] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
      db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt)),
      db.select().from(receipts).where(eq(receipts.orderId, order.id)),
    ]);

    res.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        fulfillmentMethod: order.fulfillmentMethod,
        deliveryLocationName: order.deliveryLocationName,
        subtotalUgx: order.subtotalUgx,
        deliveryFeeUgx: order.deliveryFeeUgx,
        totalUgx: order.totalUgx,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      items,
      latestPayment: orderPayments[0] || null,
      receipt: order.paymentStatus === 'paid' ? receipt || null : null,
    });
  } catch (err) {
    next(err);
  }
});

// Retrieve receipt JSON (strictly enforces paymentStatus === 'paid')
ordersRouter.get('/receipts/:receiptNumber', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.receiptNumber, req.params.receiptNumber.trim()));

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found. Receipts are only issued for paid orders.' });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, receipt.orderId));
    if (!order || order.paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'Receipt cannot be issued for an unpaid or failed transaction.' });
    }

    res.json({ receipt });
  } catch (err) {
    next(err);
  }
});

// Generate and stream downloadable PDFKit Receipt
ordersRouter.get('/receipts/:receiptNumber/pdf', async (req, res, next) => {
  try {
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.receiptNumber, req.params.receiptNumber.trim()));

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found.' });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, receipt.orderId));
    if (!order || order.paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'PDF receipt is only available for successfully paid transactions.' });
    }

    const [payment] = await db.select().from(payments).where(eq(payments.id, receipt.paymentId));
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

    const methodLabels: Record<string, string> = {
      mtn_momo: 'MTN Mobile Money (Simulated)',
      airtel_money: 'Airtel Money (Simulated)',
      card_demo: 'Visa / Mastercard (Simulated)',
      cash_on_delivery: 'Cash on Delivery / Collection',
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);

    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.pipe(res);

    // Header band
    doc.rect(0, 0, doc.page.width, 108).fill('#123B70');
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('MarketSphere', 48, 32);
    doc
      .fillColor('#BAE6FD')
      .fontSize(10)
      .font('Helvetica')
      .text('Active Supermarket Kabale · Main Street, Kabale Municipality, Uganda', 48, 60);
    doc.text('Tel: +256 772 480 120 · Academic Prototype Transaction Receipt', 48, 75);

    doc
      .fillColor('#FFFFFF')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('PAYMENT RECEIPT', 400, 36, { align: 'right', width: 145 });
    doc
      .fillColor('#38BDF8')
      .fontSize(10)
      .font('Helvetica')
      .text(receipt.receiptNumber, 400, 56, { align: 'right', width: 145 });

    // Metadata grid
    doc.fillColor('#172B4D').fontSize(10).font('Helvetica-Bold').text('Billed To (Demonstration Customer)', 48, 130);
    doc
      .font('Helvetica')
      .fillColor('#334155')
      .text(order.customerName, 48, 146)
      .text(order.customerEmail, 48, 160)
      .text(order.customerPhone, 48, 174)
      .text(`${order.fulfillmentMethod === 'collection' ? 'Store Pickup' : 'Delivery'}: ${order.deliveryLocationName}`, 48, 188, { width: 260 });

    doc.fillColor('#172B4D').font('Helvetica-Bold').text('Transaction Details', 340, 130);
    doc
      .font('Helvetica')
      .fillColor('#334155')
      .text(`Order No: ${order.orderNumber}`, 340, 146)
      .text(`Tx Ref: ${payment?.transactionRef || 'N/A'}`, 340, 160)
      .text(`Method: ${methodLabels[payment?.method || ''] || payment?.method || 'Simulated'}`, 340, 174)
      .text(`Date: ${new Date(receipt.issuedAt).toLocaleString('en-UG')}`, 340, 188)
      .text(`Payment Status: PAID (Simulated)`, 340, 202);

    // Table header
    let y = 240;
    doc.rect(48, y, 499, 26).fill('#EAF3FF');
    doc.fillColor('#123B70').font('Helvetica-Bold').fontSize(9.5);
    doc.text('ITEM DESCRIPTION', 56, y + 8);
    doc.text('QTY', 310, y + 8, { width: 40, align: 'right' });
    doc.text('UNIT PRICE', 360, y + 8, { width: 85, align: 'right' });
    doc.text('LINE TOTAL', 455, y + 8, { width: 84, align: 'right' });

    y += 32;
    doc.font('Helvetica').fontSize(9.5).fillColor('#172B4D');

    for (const item of items) {
      doc.text(`${item.productName} (${item.productSku})`, 56, y, { width: 245 });
      doc.text(String(item.quantity), 310, y, { width: 40, align: 'right' });
      doc.text(formatUgx(item.unitPriceUgx), 360, y, { width: 85, align: 'right' });
      doc.text(formatUgx(item.lineTotalUgx), 455, y, { width: 84, align: 'right' });
      y += 22;
      doc.moveTo(48, y - 4).lineTo(547, y - 4).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
    }

    y += 14;
    doc.font('Helvetica').fontSize(10).fillColor('#475569');
    doc.text('Subtotal:', 360, y, { width: 85, align: 'right' });
    doc.text(formatUgx(order.subtotalUgx), 455, y, { width: 84, align: 'right' });

    y += 18;
    doc.text('Delivery Charge:', 360, y, { width: 85, align: 'right' });
    doc.text(formatUgx(order.deliveryFeeUgx), 455, y, { width: 84, align: 'right' });

    y += 22;
    doc.rect(340, y - 4, 207, 28).fill('#123B70');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11);
    doc.text('Total Paid:', 350, y + 4, { width: 95, align: 'right' });
    doc.text(formatUgx(order.totalUgx), 455, y + 4, { width: 84, align: 'right' });

    y += 54;
    doc
      .fillColor('#172B4D')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('Thank you for shopping with Active Supermarket Kabale!', 48, y, { align: 'center', width: 499 });
    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        'This document is generated by MarketSphere for academic demonstration (MGT3151 – Uganda Christian University). Simulated transactions do not process real currency.',
        48,
        y + 18,
        { align: 'center', width: 499 }
      );

    doc.end();
  } catch (err) {
    next(err);
  }
});
