import fs from 'node:fs';
import path from 'node:path';
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  auditLogs,
  categories,
  deliveryLocations,
  inventory,
  inventoryMovements,
  products,
  promotionalBanners,
  reviews,
  storeSettings,
  testimonials,
} from '../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from './auth.ts';

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext =
      file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
        ? '.webp'
        : '.jpg';
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 32);
    cb(null, `${Date.now()}-${base || 'product'}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, and WebP images up to 5MB are allowed.'));
      return;
    }
    cb(null, true);
  },
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const catalogRouter = express.Router();

// Public storefront homepage aggregate endpoint
catalogRouter.get('/storefront/home', async (_req, res, next) => {
  try {
    const [
      activeBanners,
      activeCategories,
      allProducts,
      activeTestimonials,
      locations,
      settingsRows,
    ] = await Promise.all([
      db
        .select()
        .from(promotionalBanners)
        .where(eq(promotionalBanners.isActive, true))
        .orderBy(asc(promotionalBanners.sortOrder), asc(promotionalBanners.id)),
      db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select({
          id: products.id,
          categoryId: products.categoryId,
          categoryName: categories.name,
          categorySlug: categories.slug,
          sku: products.sku,
          name: products.name,
          slug: products.slug,
          description: products.description,
          specifications: products.specifications,
          priceUgx: products.priceUgx,
          discountPriceUgx: products.discountPriceUgx,
          imageUrl: products.imageUrl,
          isFeatured: products.isFeatured,
          promoTag: products.promoTag,
          isActive: products.isActive,
          ratingAvg: products.ratingAvg,
          reviewCount: products.reviewCount,
          quantityOnHand: inventory.quantityOnHand,
          lowStockThreshold: inventory.lowStockThreshold,
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .innerJoin(inventory, eq(products.id, inventory.productId))
        .where(eq(products.isActive, true))
        .orderBy(desc(products.isFeatured), desc(products.createdAt)),
      db
        .select()
        .from(testimonials)
        .where(eq(testimonials.isActive, true))
        .orderBy(desc(testimonials.id)),
      db.select().from(deliveryLocations).where(eq(deliveryLocations.isActive, true)),
      db.select().from(storeSettings),
    ]);

    const settings = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));

    const categoryCounts = new Map<number, number>();
    for (const p of allProducts) {
      categoryCounts.set(p.categoryId, (categoryCounts.get(p.categoryId) || 0) + 1);
    }

    res.json({
      banners: activeBanners,
      categories: activeCategories.map((c) => ({
        ...c,
        productCount: categoryCounts.get(c.id) || 0,
      })),
      featuredProducts: allProducts.filter((p) => p.isFeatured).slice(0, 8),
      todaysDeals: allProducts.filter((p) => p.promoTag === 'todays_deal' || p.discountPriceUgx !== null).slice(0, 4),
      weeklyOffers: allProducts.filter((p) => p.promoTag === 'weekly_offer').slice(0, 4),
      bestSellers: allProducts.filter((p) => p.promoTag === 'best_seller').slice(0, 4),
      newArrivals: allProducts.filter((p) => p.promoTag === 'new_arrival').slice(0, 4),
      testimonials: activeTestimonials,
      deliveryLocations: locations,
      settings,
    });
  } catch (err) {
    next(err);
  }
});

// Product search autocomplete suggestions
catalogRouter.get('/products/suggestions', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const pattern = `%${q}%`;
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        priceUgx: products.priceUgx,
        discountPriceUgx: products.discountPriceUgx,
        imageUrl: products.imageUrl,
        categoryName: categories.name,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(products.isActive, true),
          or(ilike(products.name, pattern), ilike(products.sku, pattern), ilike(categories.name, pattern))
        )
      )
      .limit(6);

    res.json({ suggestions: rows });
  } catch (err) {
    next(err);
  }
});

// Product catalog with filtering, sorting, and pagination
catalogRouter.get('/products', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const promo = String(req.query.promo || '').trim();
    const minPrice = Number(req.query.minPrice || 0);
    const maxPrice = Number(req.query.maxPrice || 0);
    const availability = String(req.query.availability || 'all');
    const sort = String(req.query.sort || 'featured');
    const includeInactive = req.query.includeInactive === 'true';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));

    const conditions = [];
    if (!includeInactive) {
      conditions.push(eq(products.isActive, true));
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(ilike(products.name, pattern), ilike(products.description, pattern), ilike(products.sku, pattern))
      );
    }
    if (category && category !== 'all') {
      const catNum = Number(category);
      if (Number.isInteger(catNum) && catNum > 0) {
        conditions.push(eq(products.categoryId, catNum));
      } else {
        conditions.push(eq(categories.slug, category));
      }
    }
    if (promo && promo !== 'all') {
      conditions.push(eq(products.promoTag, promo));
    }
    if (minPrice > 0) {
      conditions.push(gte(sql`COALESCE(${products.discountPriceUgx}, ${products.priceUgx})`, minPrice));
    }
    if (maxPrice > 0) {
      conditions.push(lte(sql`COALESCE(${products.discountPriceUgx}, ${products.priceUgx})`, maxPrice));
    }
    if (availability === 'in_stock') {
      conditions.push(gte(inventory.quantityOnHand, 1));
    } else if (availability === 'low_stock') {
      conditions.push(
        and(gte(inventory.quantityOnHand, 1), lte(inventory.quantityOnHand, inventory.lowStockThreshold))
      );
    } else if (availability === 'out_of_stock') {
      conditions.push(eq(inventory.quantityOnHand, 0));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy =
      sort === 'price_asc'
        ? asc(sql`COALESCE(${products.discountPriceUgx}, ${products.priceUgx})`)
        : sort === 'price_desc'
        ? desc(sql`COALESCE(${products.discountPriceUgx}, ${products.priceUgx})`)
        : sort === 'popular'
        ? desc(products.ratingAvg)
        : sort === 'newest'
        ? desc(products.createdAt)
        : desc(products.isFeatured);

    const [{ total }] = await db
      .select({ total: count() })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(inventory, eq(products.id, inventory.productId))
      .where(whereClause);

    const items = await db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        sku: products.sku,
        name: products.name,
        slug: products.slug,
        description: products.description,
        specifications: products.specifications,
        priceUgx: products.priceUgx,
        discountPriceUgx: products.discountPriceUgx,
        imageUrl: products.imageUrl,
        galleryUrls: products.galleryUrls,
        isFeatured: products.isFeatured,
        promoTag: products.promoTag,
        isActive: products.isActive,
        ratingAvg: products.ratingAvg,
        reviewCount: products.reviewCount,
        quantityOnHand: inventory.quantityOnHand,
        lowStockThreshold: inventory.lowStockThreshold,
        createdAt: products.createdAt,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(inventory, eq(products.id, inventory.productId))
      .where(whereClause)
      .orderBy(orderBy, desc(products.id))
      .limit(limit)
      .offset((page - 1) * limit);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

// Single product detail + reviews + related products
catalogRouter.get('/products/:idOrSlug', async (req, res, next) => {
  try {
    const param = req.params.idOrSlug;
    const numericId = Number(param);
    const matchClause =
      Number.isInteger(numericId) && numericId > 0
        ? eq(products.id, numericId)
        : eq(products.slug, param);

    const [product] = await db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        sku: products.sku,
        name: products.name,
        slug: products.slug,
        description: products.description,
        specifications: products.specifications,
        priceUgx: products.priceUgx,
        discountPriceUgx: products.discountPriceUgx,
        imageUrl: products.imageUrl,
        galleryUrls: products.galleryUrls,
        isFeatured: products.isFeatured,
        promoTag: products.promoTag,
        isActive: products.isActive,
        ratingAvg: products.ratingAvg,
        reviewCount: products.reviewCount,
        quantityOnHand: inventory.quantityOnHand,
        lowStockThreshold: inventory.lowStockThreshold,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(inventory, eq(products.id, inventory.productId))
      .where(matchClause);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const [productReviews, related] = await Promise.all([
      db
        .select()
        .from(reviews)
        .where(and(eq(reviews.productId, product.id), eq(reviews.isApproved, true)))
        .orderBy(desc(reviews.createdAt)),
      db
        .select({
          id: products.id,
          categoryId: products.categoryId,
          categoryName: categories.name,
          categorySlug: categories.slug,
          sku: products.sku,
          name: products.name,
          slug: products.slug,
          priceUgx: products.priceUgx,
          discountPriceUgx: products.discountPriceUgx,
          imageUrl: products.imageUrl,
          isFeatured: products.isFeatured,
          promoTag: products.promoTag,
          ratingAvg: products.ratingAvg,
          reviewCount: products.reviewCount,
          quantityOnHand: inventory.quantityOnHand,
          lowStockThreshold: inventory.lowStockThreshold,
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .innerJoin(inventory, eq(products.id, inventory.productId))
        .where(
          and(
            eq(products.categoryId, product.categoryId),
            eq(products.isActive, true),
            sql`${products.id} != ${product.id}`
          )
        )
        .limit(4),
    ]);

    res.json({ product, reviews: productReviews, related });
  } catch (err) {
    next(err);
  }
});

// Add product review (authenticated customer)
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5, 'Review comment must be at least 5 characters').max(500),
});

catalogRouter.post('/products/:id/reviews', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const productId = Number(req.params.id);
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid review' });
    }

    const [created] = await db
      .insert(reviews)
      .values({
        productId,
        userId: req.authUser!.id,
        authorName: req.authUser!.fullName,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        isApproved: true,
      })
      .returning();

    const allReviews = await db
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.isApproved, true)));

    const avg =
      allReviews.length > 0
        ? Number((allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1))
        : 5;

    await db
      .update(products)
      .set({ ratingAvg: avg, reviewCount: allReviews.length })
      .where(eq(products.id, productId));

    res.status(201).json({ review: created });
  } catch (err) {
    next(err);
  }
});

// Admin Product CRUD
const productPayloadSchema = z.object({
  categoryId: z.number().int().positive(),
  sku: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).default(''),
  specifications: z.record(z.string(), z.string()).default({}),
  priceUgx: z.number().int().positive(),
  discountPriceUgx: z.number().int().positive().nullable().optional(),
  imageUrl: z.string().trim().max(500).default(''),
  isFeatured: z.boolean().default(false),
  promoTag: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  quantityOnHand: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(10),
});

catalogRouter.post(
  '/products',
  requireAuth,
  requireRole(['admin']),
  async (req: AuthRequest, res, next) => {
    try {
      const parsed = productPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product payload' });
      }
      const d = parsed.data;
      if (d.discountPriceUgx && d.discountPriceUgx >= d.priceUgx) {
        return res.status(400).json({ error: 'Discount price must be lower than regular price.' });
      }

      const slug = `${slugify(d.name)}-${Date.now().toString().slice(-4)}`;
      const result = await db.transaction(async (tx) => {
        const [prod] = await tx
          .insert(products)
          .values({
            categoryId: d.categoryId,
            sku: d.sku,
            name: d.name,
            slug,
            description: d.description,
            specifications: d.specifications,
            priceUgx: d.priceUgx,
            discountPriceUgx: d.discountPriceUgx ?? null,
            imageUrl: d.imageUrl || '/src/assets/images/prod_pantry_staples_1795549634803.jpg',
            isFeatured: d.isFeatured,
            promoTag: d.promoTag || null,
            isActive: d.isActive,
          })
          .returning();

        await tx.insert(inventory).values({
          productId: prod.id,
          quantityOnHand: d.quantityOnHand,
          reservedQuantity: 0,
          lowStockThreshold: d.lowStockThreshold,
        });

        await tx.insert(inventoryMovements).values({
          productId: prod.id,
          actorUserId: req.authUser!.id,
          movementType: 'restock',
          quantityDelta: d.quantityOnHand,
          balanceAfter: d.quantityOnHand,
          referenceType: 'product_created',
          referenceId: prod.id,
          note: 'Initial stock on product creation',
        });

        await tx.insert(auditLogs).values({
          actorUserId: req.authUser!.id,
          actorEmail: req.authUser!.email,
          action: 'PRODUCT_CREATED',
          entityType: 'product',
          entityId: String(prod.id),
          details: { name: prod.name, sku: prod.sku, priceUgx: prod.priceUgx },
        });

        return prod;
      });

      res.status(201).json({ product: result });
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.put(
  '/products/:id',
  requireAuth,
  requireRole(['admin']),
  async (req: AuthRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      const parsed = productPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product update' });
      }
      const d = parsed.data;
      if (d.discountPriceUgx && d.discountPriceUgx >= d.priceUgx) {
        return res.status(400).json({ error: 'Discount price must be lower than regular price.' });
      }

      const updated = await db.transaction(async (tx) => {
        const [prod] = await tx
          .update(products)
          .set({
            categoryId: d.categoryId,
            sku: d.sku,
            name: d.name,
            description: d.description,
            specifications: d.specifications,
            priceUgx: d.priceUgx,
            discountPriceUgx: d.discountPriceUgx ?? null,
            imageUrl: d.imageUrl,
            isFeatured: d.isFeatured,
            promoTag: d.promoTag || null,
            isActive: d.isActive,
            updatedAt: new Date(),
          })
          .where(eq(products.id, id))
          .returning();

        if (!prod) return null;

        const [inv] = await tx.select().from(inventory).where(eq(inventory.productId, id));
        if (inv) {
          const delta = d.quantityOnHand - inv.quantityOnHand;
          await tx
            .update(inventory)
            .set({
              quantityOnHand: d.quantityOnHand,
              lowStockThreshold: d.lowStockThreshold,
              updatedAt: new Date(),
            })
            .where(eq(inventory.productId, id));

          if (delta !== 0) {
            await tx.insert(inventoryMovements).values({
              productId: id,
              actorUserId: req.authUser!.id,
              movementType: 'adjustment',
              quantityDelta: delta,
              balanceAfter: d.quantityOnHand,
              referenceType: 'product_edit',
              referenceId: id,
              note: 'Adjusted from product editor',
            });
          }
        }

        await tx.insert(auditLogs).values({
          actorUserId: req.authUser!.id,
          actorEmail: req.authUser!.email,
          action: 'PRODUCT_UPDATED',
          entityType: 'product',
          entityId: String(id),
          details: { name: prod.name },
        });

        return prod;
      });

      if (!updated) {
        return res.status(404).json({ error: 'Product not found.' });
      }
      res.json({ product: updated });
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.delete(
  '/products/:id',
  requireAuth,
  requireRole(['admin']),
  async (req: AuthRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      const [updated] = await db
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      await db.insert(auditLogs).values({
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'PRODUCT_DEACTIVATED',
        entityType: 'product',
        entityId: String(id),
        details: { name: updated.name },
      });

      res.json({ ok: true, product: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Multer image upload endpoint (Admin only)
catalogRouter.post(
  '/uploads/product-image',
  requireAuth,
  requireRole(['admin']),
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select a valid image file (JPEG, PNG, or WebP, max 5MB).' });
    }
    res.status(201).json({
      imageUrl: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      size: req.file.size,
    });
  }
);

// Categories CRUD
catalogRouter.get('/categories', async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const rows = includeInactive
      ? await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
      : await db
          .select()
          .from(categories)
          .where(eq(categories.isActive, true))
          .orderBy(asc(categories.sortOrder), asc(categories.name));

    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
});

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(''),
  iconName: z.string().trim().max(40).default('ShoppingBasket'),
  imageUrl: z.string().trim().max(500).default(''),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

catalogRouter.post(
  '/categories',
  requireAuth,
  requireRole(['admin']),
  async (req: AuthRequest, res, next) => {
    try {
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid category data' });
      }

      const [created] = await db
        .insert(categories)
        .values({
          ...parsed.data,
          slug: `${slugify(parsed.data.name)}-${Date.now().toString().slice(-3)}`,
        })
        .returning();

      res.status(201).json({ category: created });
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.put(
  '/categories/:id',
  requireAuth,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid category data' });
      }

      const [updated] = await db
        .update(categories)
        .set(parsed.data)
        .where(eq(categories.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Category not found.' });
      res.json({ category: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Promotional Hero Banners CRUD
catalogRouter.get('/banners', async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(promotionalBanners)
      .orderBy(asc(promotionalBanners.sortOrder), asc(promotionalBanners.id));
    res.json({ banners: rows });
  } catch (err) {
    next(err);
  }
});

const bannerSchema = z.object({
  title: z.string().trim().min(3).max(160),
  subtitle: z.string().trim().min(5).max(320),
  badgeText: z.string().trim().max(50).default('Featured Campaign'),
  discountText: z.string().trim().max(60).default(''),
  imageUrl: z.string().trim().min(1).max(500),
  ctaText: z.string().trim().max(40).default('Shop Now'),
  ctaLink: z.string().trim().max(200).default('/catalog'),
  secondaryCtaText: z.string().trim().max(40).default('Explore Categories'),
  secondaryCtaLink: z.string().trim().max(200).default('/catalog'),
  sortOrder: z.number().int().default(1),
  isActive: z.boolean().default(true),
});

catalogRouter.post(
  '/banners',
  requireAuth,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const parsed = bannerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid slide payload' });
      }
      const [created] = await db.insert(promotionalBanners).values(parsed.data).returning();
      res.status(201).json({ banner: created });
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.put(
  '/banners/:id',
  requireAuth,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const parsed = bannerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid slide payload' });
      }
      const [updated] = await db
        .update(promotionalBanners)
        .set(parsed.data)
        .where(eq(promotionalBanners.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Banner not found.' });
      res.json({ banner: updated });
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.delete(
  '/banners/:id',
  requireAuth,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      await db.delete(promotionalBanners).where(eq(promotionalBanners.id, id));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// Testimonials CRUD
catalogRouter.get('/testimonials', async (_req, res, next) => {
  try {
    const rows = await db.select().from(testimonials).orderBy(desc(testimonials.id));
    res.json({ testimonials: rows });
  } catch (err) {
    next(err);
  }
});

const testimonialSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  roleOrLocation: z.string().trim().min(2).max(120),
  rating: z.number().int().min(1).max(5).default(5),
  quote: z.string().trim().min(10).max(400),
  isDemo: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

catalogRouter.post(
  '/testimonials',
  requireAuth,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const parsed = testimonialSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid testimonial' });
      }
      const [created] = await db.insert(testimonials).values(parsed.data).returning();
      res.status(201).json({ testimonial: created });
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.put(
  '/testimonials/:id',
  requireAuth,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const parsed = testimonialSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid testimonial' });
      }
      const [updated] = await db
        .update(testimonials)
        .set(parsed.data)
        .where(eq(testimonials.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Testimonial not found.' });
      res.json({ testimonial: updated });
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.delete(
  '/testimonials/:id',
  requireAuth,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      await db.delete(testimonials).where(eq(testimonials.id, id));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);
