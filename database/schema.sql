-- ============================================================================
-- MarketSphere — Active Supermarket Kabale
-- Complete Normalised Relational SQL Schema (PostgreSQL / Cloud SQL)
-- Includes Foreign Key Constraints, Unique Constraints, CHECK Constraints,
-- Timestamps, and Performance Indexes
-- ============================================================================

-- 1. USERS & ROLE-BASED ACCESS CONTROL
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  uid             TEXT UNIQUE,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT NOT NULL DEFAULT '',
  password_hash   TEXT,
  role            TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- 2. PRODUCT CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL DEFAULT '',
  icon_name       TEXT NOT NULL DEFAULT 'ShoppingBasket',
  image_url       TEXT NOT NULL DEFAULT '',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_active_order ON categories (is_active, sort_order);

-- 3. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id                  SERIAL PRIMARY KEY,
  category_id         INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  sku                 TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT NOT NULL DEFAULT '',
  specifications      JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_ugx           INTEGER NOT NULL CHECK (price_ugx > 0),
  discount_price_ugx  INTEGER CHECK (discount_price_ugx IS NULL OR (discount_price_ugx > 0 AND discount_price_ugx < price_ugx)),
  image_url           TEXT NOT NULL DEFAULT '',
  gallery_urls        JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
  promo_tag           TEXT CHECK (promo_tag IS NULL OR promo_tag IN ('todays_deal', 'weekly_offer', 'best_seller', 'new_arrival')),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  rating_avg          REAL NOT NULL DEFAULT 4.6 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  review_count        INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_featured ON products (is_active, is_featured);
CREATE INDEX IF NOT EXISTS idx_products_promo_tag ON products (promo_tag);

-- 4. INVENTORY & STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS inventory (
  id                    SERIAL PRIMARY KEY,
  product_id            INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
  quantity_on_hand      INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reserved_quantity     INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  low_stock_threshold   INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory (quantity_on_hand, low_stock_threshold);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  actor_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  movement_type   TEXT NOT NULL CHECK (movement_type IN ('restock', 'sale', 'adjustment', 'return', 'release')),
  quantity_delta  INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),
  reference_type  TEXT NOT NULL DEFAULT 'manual',
  reference_id    INTEGER,
  note            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_product ON inventory_movements (product_id, created_at DESC);

-- 5. DELIVERY LOCATIONS & SAVED CUSTOMER ADDRESSES
CREATE TABLE IF NOT EXISTS delivery_locations (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  region            TEXT NOT NULL DEFAULT 'Kabale District',
  delivery_type     TEXT NOT NULL DEFAULT 'delivery' CHECK (delivery_type IN ('delivery', 'collection')),
  fee_ugx           INTEGER NOT NULL DEFAULT 0 CHECK (fee_ugx >= 0),
  estimated_window  TEXT NOT NULL DEFAULT 'Same day (2-4 hrs)',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS delivery_addresses (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  recipient_name  TEXT NOT NULL,
  phone           TEXT NOT NULL,
  location_id     INTEGER REFERENCES delivery_locations(id) ON DELETE SET NULL,
  street_details  TEXT NOT NULL,
  landmark        TEXT NOT NULL DEFAULT '',
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user ON delivery_addresses (user_id);

-- 6. WISHLISTS
CREATE TABLE IF NOT EXISTS wishlists (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

-- 7. ORDERS & ORDER LINE ITEMS
CREATE TABLE IF NOT EXISTS orders (
  id                      SERIAL PRIMARY KEY,
  order_number            TEXT NOT NULL UNIQUE,
  user_id                 INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name           TEXT NOT NULL,
  customer_email          TEXT NOT NULL,
  customer_phone          TEXT NOT NULL,
  fulfillment_method      TEXT NOT NULL CHECK (fulfillment_method IN ('delivery', 'collection')),
  delivery_location_id    INTEGER REFERENCES delivery_locations(id) ON DELETE SET NULL,
  delivery_location_name  TEXT NOT NULL,
  delivery_address_text   TEXT NOT NULL DEFAULT '',
  delivery_notes          TEXT NOT NULL DEFAULT '',
  subtotal_ugx            INTEGER NOT NULL CHECK (subtotal_ugx >= 0),
  delivery_fee_ugx        INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_ugx >= 0),
  total_ugx               INTEGER NOT NULL CHECK (total_ugx >= 0),
  status                  TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN (
                            'Pending', 'Confirmed', 'Processing',
                            'Ready for collection', 'Out for delivery', 'Delivered', 'Cancelled'
                          )),
  payment_status          TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name    TEXT NOT NULL,
  product_sku     TEXT NOT NULL,
  unit_price_ugx  INTEGER NOT NULL CHECK (unit_price_ugx >= 0),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  line_total_ugx  INTEGER NOT NULL CHECK (line_total_ugx >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- 8. SIMULATED PAYMENTS & RECEIPTS
CREATE TABLE IF NOT EXISTS payments (
  id                      SERIAL PRIMARY KEY,
  order_id                INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method                  TEXT NOT NULL CHECK (method IN ('mtn_momo', 'airtel_money', 'card_demo', 'cash_on_delivery')),
  transaction_ref         TEXT NOT NULL UNIQUE,
  amount_ugx              INTEGER NOT NULL CHECK (amount_ugx >= 0),
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  simulated_account_mask  TEXT NOT NULL DEFAULT '',
  failure_reason          TEXT,
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status, created_at DESC);

CREATE TABLE IF NOT EXISTS receipts (
  id              SERIAL PRIMARY KEY,
  receipt_number  TEXT NOT NULL UNIQUE,
  order_id        INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  payment_id      INTEGER NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_json   JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_issued ON receipts (issued_at DESC);

-- 9. REVIEWS, TESTIMONIALS, PROMOTIONAL BANNERS, NOTIFICATIONS & AUDIT LOGS
CREATE TABLE IF NOT EXISTS reviews (
  id           SERIAL PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name  TEXT NOT NULL,
  rating       INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment      TEXT NOT NULL,
  is_approved  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews (product_id, is_approved);

CREATE TABLE IF NOT EXISTS testimonials (
  id                SERIAL PRIMARY KEY,
  customer_name     TEXT NOT NULL,
  role_or_location  TEXT NOT NULL,
  rating            INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  quote             TEXT NOT NULL,
  is_demo           BOOLEAN NOT NULL DEFAULT TRUE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotional_banners (
  id                  SERIAL PRIMARY KEY,
  title               TEXT NOT NULL,
  subtitle            TEXT NOT NULL,
  badge_text          TEXT NOT NULL DEFAULT 'Featured Campaign',
  discount_text       TEXT NOT NULL DEFAULT '',
  image_url           TEXT NOT NULL,
  cta_text            TEXT NOT NULL DEFAULT 'Shop Now',
  cta_link            TEXT NOT NULL DEFAULT '/catalog',
  secondary_cta_text  TEXT NOT NULL DEFAULT 'Explore Categories',
  secondary_cta_link  TEXT NOT NULL DEFAULT '/catalog',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_target  TEXT NOT NULL DEFAULT 'admin',
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  link_url     TEXT NOT NULL DEFAULT '',
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_role_read ON notifications (role_target, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS price_alerts (
  id                       SERIAL PRIMARY KEY,
  user_id                  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email                    TEXT NOT NULL,
  product_id               INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_price_ugx         INTEGER CHECK (target_price_ugx IS NULL OR target_price_ugx > 0),
  baseline_price_ugx       INTEGER NOT NULL CHECK (baseline_price_ugx > 0),
  status                   TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'paused')),
  last_triggered_price_ugx INTEGER,
  triggered_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_product_status ON price_alerts (product_id, status);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts (user_id, email);

CREATE TABLE IF NOT EXISTS audit_logs (
  id             SERIAL PRIMARY KEY,
  actor_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_email    TEXT NOT NULL DEFAULT 'system',
  action         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      TEXT NOT NULL DEFAULT '',
  details        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS store_settings (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
