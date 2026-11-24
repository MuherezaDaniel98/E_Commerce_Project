import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').default('').notNull(),
  passwordHash: text('password_hash'),
  role: text('role').default('customer').notNull(), // 'customer' | 'staff' | 'admin'
  status: text('status').default('active').notNull(), // 'active' | 'suspended'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').default('').notNull(),
  iconName: text('icon_name').default('ShoppingBasket').notNull(),
  imageUrl: text('image_url').default('').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .references(() => categories.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').default('').notNull(),
  specifications: jsonb('specifications').$type<Record<string, string>>().default({}).notNull(),
  priceUgx: integer('price_ugx').notNull(),
  discountPriceUgx: integer('discount_price_ugx'),
  imageUrl: text('image_url').default('').notNull(),
  galleryUrls: jsonb('gallery_urls').$type<string[]>().default([]).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  promoTag: text('promo_tag'), // 'todays_deal' | 'weekly_offer' | 'best_seller' | 'new_arrival' | null
  isActive: boolean('is_active').default(true).notNull(),
  ratingAvg: real('rating_avg').default(4.6).notNull(),
  reviewCount: integer('review_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull()
    .unique(),
  quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
  reservedQuantity: integer('reserved_quantity').default(0).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(10).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const inventoryMovements = pgTable('inventory_movements', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  actorUserId: integer('actor_user_id').references(() => users.id),
  movementType: text('movement_type').notNull(), // 'restock' | 'sale' | 'adjustment' | 'return'
  quantityDelta: integer('quantity_delta').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  referenceType: text('reference_type').default('manual').notNull(),
  referenceId: integer('reference_id'),
  note: text('note').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const deliveryLocations = pgTable('delivery_locations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  region: text('region').default('Kabale District').notNull(),
  deliveryType: text('delivery_type').default('delivery').notNull(), // 'delivery' | 'collection'
  feeUgx: integer('fee_ugx').default(0).notNull(),
  estimatedWindow: text('estimated_window').default('Same day (2-4 hrs)').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const deliveryAddresses = pgTable('delivery_addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  label: text('label').notNull(),
  recipientName: text('recipient_name').notNull(),
  phone: text('phone').notNull(),
  locationId: integer('location_id').references(() => deliveryLocations.id),
  streetDetails: text('street_details').notNull(),
  landmark: text('landmark').default('').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  fulfillmentMethod: text('fulfillment_method').notNull(), // 'delivery' | 'collection'
  deliveryLocationId: integer('delivery_location_id').references(() => deliveryLocations.id),
  deliveryLocationName: text('delivery_location_name').notNull(),
  deliveryAddressText: text('delivery_address_text').default('').notNull(),
  deliveryNotes: text('delivery_notes').default('').notNull(),
  subtotalUgx: integer('subtotal_ugx').notNull(),
  deliveryFeeUgx: integer('delivery_fee_ugx').default(0).notNull(),
  totalUgx: integer('total_ugx').notNull(),
  status: text('status').default('Pending').notNull(),
  paymentStatus: text('payment_status').default('pending').notNull(), // 'pending' | 'paid' | 'failed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  productName: text('product_name').notNull(),
  productSku: text('product_sku').notNull(),
  unitPriceUgx: integer('unit_price_ugx').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotalUgx: integer('line_total_ugx').notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  method: text('method').notNull(), // 'mtn_momo' | 'airtel_money' | 'card_demo' | 'cash_on_delivery'
  transactionRef: text('transaction_ref').notNull().unique(),
  amountUgx: integer('amount_ugx').notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'paid' | 'failed'
  simulatedAccountMask: text('simulated_account_mask').default('').notNull(),
  failureReason: text('failure_reason'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  receiptNumber: text('receipt_number').notNull().unique(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull()
    .unique(),
  paymentId: integer('payment_id')
    .references(() => payments.id)
    .notNull()
    .unique(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  snapshotJson: jsonb('snapshot_json').$type<Record<string, unknown>>().notNull(),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  userId: integer('user_id').references(() => users.id),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment').notNull(),
  isApproved: boolean('is_approved').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const testimonials = pgTable('testimonials', {
  id: serial('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  roleOrLocation: text('role_or_location').notNull(),
  rating: integer('rating').default(5).notNull(),
  quote: text('quote').notNull(),
  isDemo: boolean('is_demo').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const promotionalBanners = pgTable('promotional_banners', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull(),
  badgeText: text('badge_text').default('Featured Campaign').notNull(),
  discountText: text('discount_text').default('').notNull(),
  imageUrl: text('image_url').notNull(),
  ctaText: text('cta_text').default('Shop Now').notNull(),
  ctaLink: text('cta_link').default('/catalog').notNull(),
  secondaryCtaText: text('secondary_cta_text').default('Explore Categories').notNull(),
  secondaryCtaLink: text('secondary_cta_link').default('/catalog').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  roleTarget: text('role_target').default('admin').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id),
  actorEmail: text('actor_email').default('system').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').default('').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const storeSettings = pgTable('store_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Drizzle Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  inventory: one(inventory, {
    fields: [products.id],
    references: [inventory.productId],
  }),
  movements: many(inventoryMovements),
  reviews: many(reviews),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  payments: many(payments),
  receipt: one(receipts, {
    fields: [orders.id],
    references: [receipts.orderId],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  order: one(orders, {
    fields: [receipts.orderId],
    references: [orders.id],
  }),
  payment: one(payments, {
    fields: [receipts.paymentId],
    references: [payments.id],
  }),
}));
