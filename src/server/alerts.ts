import { and, desc, eq, or, sql } from 'drizzle-orm';
import express from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  auditLogs,
  categories,
  inventory,
  notifications,
  priceAlerts,
  products,
  users,
} from '../db/schema.ts';
import { type AuthRequest, optionalAuth, requireAuth } from './auth.ts';

function formatUgxServer(amount: number): string {
  return `UGX ${Number(amount || 0).toLocaleString('en-US')}`;
}

export async function triggerPriceAlertsForProduct(
  tx: any,
  productId: number,
  productName: string,
  productSlug: string,
  oldEffectivePriceUgx: number,
  newEffectivePriceUgx: number
): Promise<number> {
  if (newEffectivePriceUgx >= oldEffectivePriceUgx) {
    return 0;
  }

  const activeAlerts = await tx
    .select()
    .from(priceAlerts)
    .where(and(eq(priceAlerts.productId, productId), eq(priceAlerts.status, 'active')));

  let triggeredCount = 0;

  for (const alert of activeAlerts) {
    const meetsTarget =
      alert.targetPriceUgx === null
        ? newEffectivePriceUgx < alert.baselinePriceUgx
        : newEffectivePriceUgx <= alert.targetPriceUgx;

    if (!meetsTarget) continue;

    await tx
      .update(priceAlerts)
      .set({
        status: 'triggered',
        lastTriggeredPriceUgx: newEffectivePriceUgx,
        triggeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(priceAlerts.id, alert.id));

    const pctDrop = Math.max(
      1,
      Math.round(((alert.baselinePriceUgx - newEffectivePriceUgx) / alert.baselinePriceUgx) * 100)
    );

    if (alert.userId) {
      await tx.insert(notifications).values({
        userId: alert.userId,
        roleTarget: 'customer',
        title: `Price Drop: ${productName}`,
        message: `Dropped from ${formatUgxServer(alert.baselinePriceUgx)} to ${formatUgxServer(
          newEffectivePriceUgx
        )} (Save ${pctDrop}%).`,
        linkUrl: `/product/${productSlug}`,
        isRead: false,
      });
    }

    triggeredCount += 1;
  }

  if (triggeredCount > 0) {
    await tx.insert(auditLogs).values({
      actorUserId: null,
      actorEmail: 'system',
      action: 'PRICE_ALERTS_TRIGGERED',
      entityType: 'product',
      entityId: String(productId),
      details: {
        productName,
        oldPriceUgx: oldEffectivePriceUgx,
        newPriceUgx: newEffectivePriceUgx,
        triggeredCount,
      },
    });
  }

  return triggeredCount;
}

export const alertsRouter = express.Router();

const createAlertSchema = z.object({
  productId: z.number().int().positive(),
  targetPriceUgx: z.number().int().positive().nullable().optional(),
  email: z.string().trim().email('Please provide a valid email address.').max(160).optional(),
});

// Create or update a customer's price alert for a product
alertsRouter.post('/price-alerts', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid price alert request.' });
    }

    const emailRaw = req.authUser?.email || parsed.data.email;
    if (!emailRaw) {
      return res.status(400).json({ error: 'Please sign in or enter your email address to receive price alerts.' });
    }
    const email = emailRaw.trim().toLowerCase();

    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, parsed.data.productId), eq(products.isActive, true)));

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const currentEffective = product.discountPriceUgx ?? product.priceUgx;
    const targetPrice = parsed.data.targetPriceUgx ?? null;

    if (targetPrice !== null && targetPrice >= currentEffective) {
      return res.status(400).json({
        error: `Target price must be lower than the current price (${formatUgxServer(currentEffective)}).`,
      });
    }

    let linkedUserId = req.authUser?.id ?? null;
    if (!linkedUserId) {
      const [matchedUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`);
      if (matchedUser) {
        linkedUserId = matchedUser.id;
      }
    }

    const [existing] = await db
      .select()
      .from(priceAlerts)
      .where(and(sql`lower(${priceAlerts.email}) = ${email}`, eq(priceAlerts.productId, product.id)));

    if (existing) {
      const [updated] = await db
        .update(priceAlerts)
        .set({
          userId: linkedUserId ?? existing.userId,
          targetPriceUgx: targetPrice,
          baselinePriceUgx: currentEffective,
          status: 'active',
          lastTriggeredPriceUgx: null,
          triggeredAt: null,
          updatedAt: new Date(),
        })
        .where(eq(priceAlerts.id, existing.id))
        .returning();

      return res.json({
        alert: {
          id: updated.id,
          productId: updated.productId,
          targetPriceUgx: updated.targetPriceUgx,
          baselinePriceUgx: updated.baselinePriceUgx,
          status: updated.status,
          createdAt: updated.createdAt,
        },
        updated: true,
      });
    }

    const [created] = await db
      .insert(priceAlerts)
      .values({
        userId: linkedUserId,
        email,
        productId: product.id,
        targetPriceUgx: targetPrice,
        baselinePriceUgx: currentEffective,
        status: 'active',
      })
      .returning();

    res.status(201).json({
      alert: {
        id: created.id,
        productId: created.productId,
        targetPriceUgx: created.targetPriceUgx,
        baselinePriceUgx: created.baselinePriceUgx,
        status: created.status,
        createdAt: created.createdAt,
      },
      updated: false,
    });
  } catch (err) {
    next(err);
  }
});

// Quick toggle "notify on any price drop" for signed-in users (used on product cards)
alertsRouter.post('/price-alerts/toggle', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.body?.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Valid productId is required.' });
    }

    const userEmail = req.authUser!.email.trim().toLowerCase();
    const [existing] = await db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.productId, productId),
          or(eq(priceAlerts.userId, req.authUser!.id), sql`lower(${priceAlerts.email}) = ${userEmail}`)
        )
      );

    if (existing && existing.status === 'active') {
      await db.delete(priceAlerts).where(eq(priceAlerts.id, existing.id));
      return res.json({ watching: false });
    }

    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.isActive, true)));

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const currentEffective = product.discountPriceUgx ?? product.priceUgx;
    if (existing) {
      await db
        .update(priceAlerts)
        .set({
          userId: req.authUser!.id,
          baselinePriceUgx: currentEffective,
          targetPriceUgx: null,
          status: 'active',
          lastTriggeredPriceUgx: null,
          triggeredAt: null,
          updatedAt: new Date(),
        })
        .where(eq(priceAlerts.id, existing.id));
    } else {
      await db.insert(priceAlerts).values({
        userId: req.authUser!.id,
        email: userEmail,
        productId,
        targetPriceUgx: null,
        baselinePriceUgx: currentEffective,
        status: 'active',
      });
    }

    res.json({ watching: true });
  } catch (err) {
    next(err);
  }
});

// Get alert status & watcher count for a single product
alertsRouter.get('/price-alerts/product/:productId', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }

    const activeWatchers = await db
      .select({ id: priceAlerts.id })
      .from(priceAlerts)
      .where(and(eq(priceAlerts.productId, productId), eq(priceAlerts.status, 'active')));

    let userAlert = null;
    if (req.authUser) {
      const userEmail = req.authUser.email.trim().toLowerCase();
      const [found] = await db
        .select()
        .from(priceAlerts)
        .where(
          and(
            eq(priceAlerts.productId, productId),
            or(eq(priceAlerts.userId, req.authUser.id), sql`lower(${priceAlerts.email}) = ${userEmail}`)
          )
        );
      userAlert = found || null;
    }

    res.json({
      watcherCount: activeWatchers.length,
      alert: userAlert,
    });
  } catch (err) {
    next(err);
  }
});

// Get all price alerts for the signed-in customer
alertsRouter.get('/price-alerts', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userEmail = req.authUser!.email.trim().toLowerCase();

    // Link any prior email-matched alerts to this user account
    await db
      .update(priceAlerts)
      .set({ userId: req.authUser!.id })
      .where(and(sql`lower(${priceAlerts.email}) = ${userEmail}`, sql`${priceAlerts.userId} IS NULL`));

    const rows = await db
      .select({
        id: priceAlerts.id,
        productId: priceAlerts.productId,
        email: priceAlerts.email,
        targetPriceUgx: priceAlerts.targetPriceUgx,
        baselinePriceUgx: priceAlerts.baselinePriceUgx,
        status: priceAlerts.status,
        lastTriggeredPriceUgx: priceAlerts.lastTriggeredPriceUgx,
        triggeredAt: priceAlerts.triggeredAt,
        createdAt: priceAlerts.createdAt,
        updatedAt: priceAlerts.updatedAt,
        productName: products.name,
        productSlug: products.slug,
        imageUrl: products.imageUrl,
        priceUgx: products.priceUgx,
        discountPriceUgx: products.discountPriceUgx,
        categoryName: categories.name,
        quantityOnHand: inventory.quantityOnHand,
      })
      .from(priceAlerts)
      .innerJoin(products, eq(priceAlerts.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(inventory, eq(products.id, inventory.productId))
      .where(or(eq(priceAlerts.userId, req.authUser!.id), sql`lower(${priceAlerts.email}) = ${userEmail}`))
      .orderBy(desc(priceAlerts.updatedAt));

    res.json({ alerts: rows });
  } catch (err) {
    next(err);
  }
});

const updateAlertSchema = z.object({
  targetPriceUgx: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'paused']).optional(),
});

// Update target price or pause/resume an alert
alertsRouter.patch('/price-alerts/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = updateAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid update payload.' });
    }

    const userEmail = req.authUser!.email.trim().toLowerCase();
    const [existing] = await db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.id, id),
          or(eq(priceAlerts.userId, req.authUser!.id), sql`lower(${priceAlerts.email}) = ${userEmail}`)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Price alert not found.' });
    }

    const [product] = await db.select().from(products).where(eq(products.id, existing.productId));
    const currentEffective = product ? product.discountPriceUgx ?? product.priceUgx : existing.baselinePriceUgx;

    const nextTarget =
      parsed.data.targetPriceUgx !== undefined ? parsed.data.targetPriceUgx : existing.targetPriceUgx;

    if (nextTarget !== null && nextTarget >= currentEffective) {
      return res.status(400).json({
        error: `Target price must be lower than the current price (${formatUgxServer(currentEffective)}).`,
      });
    }

    const nextStatus = parsed.data.status || existing.status;

    const [updated] = await db
      .update(priceAlerts)
      .set({
        targetPriceUgx: nextTarget,
        baselinePriceUgx: nextStatus === 'active' ? currentEffective : existing.baselinePriceUgx,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(priceAlerts.id, id))
      .returning();

    res.json({ alert: updated });
  } catch (err) {
    next(err);
  }
});

// Delete a price alert
alertsRouter.delete('/price-alerts/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const userEmail = req.authUser!.email.trim().toLowerCase();

    const deleted = await db
      .delete(priceAlerts)
      .where(
        and(
          eq(priceAlerts.id, id),
          or(eq(priceAlerts.userId, req.authUser!.id), sql`lower(${priceAlerts.email}) = ${userEmail}`)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Price alert not found.' });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Customer price drop notifications feed
alertsRouter.get('/customer/notifications', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, req.authUser!.id), eq(notifications.roleTarget, 'customer')))
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    const unreadCount = rows.filter((r) => !r.isRead).length;
    res.json({ notifications: rows, unreadCount });
  } catch (err) {
    next(err);
  }
});

alertsRouter.patch('/customer/notifications/read-all', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, req.authUser!.id), eq(notifications.roleTarget, 'customer')));

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

alertsRouter.patch('/customer/notifications/:id/read', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, req.authUser!.id),
          eq(notifications.roleTarget, 'customer')
        )
      );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

alertsRouter.delete('/customer/notifications/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, req.authUser!.id),
          eq(notifications.roleTarget, 'customer')
        )
      );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
