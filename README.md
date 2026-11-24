# MarketSphere — Active Supermarket Kabale

Integrated B2C E-Commerce Storefront, Simulated Mobile Money Checkout, PDF Receipt Engine, Order Tracking, and Retail Business Intelligence Platform built for **Active Supermarket Kabale** (MGT3151: E-Business, E-Commerce and E-Governance, Uganda Christian University).

## Architecture Overview

- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router DOM, Recharts, Lucide React, Axios, Sonner.
- **Backend**: Node.js, Express.js REST API, Drizzle ORM (`drizzle-orm/node-postgres`), Helmet, `express-rate-limit`, Zod validation, Multer image uploads, PDFKit receipt & report generation, `bcryptjs` password hashing, JWT + Firebase Admin ID token verification.
- **Database**: Cloud SQL (PostgreSQL) with 18 normalised tables defined in `src/db/schema.ts` and exported as pure DDL in `database/schema.sql`.

## Key Features

- **Customer Storefront**: Dynamic promotional hero carousel, 9 supermarket category shortcuts, live search with database suggestions, tabbed deal collections, full product catalogue with price/category/availability filters, product detail pages with reviews, slide-over shopping basket, and wishlist.
- **6-Step Guided Checkout & Simulated Payments**: Kabale & Kigezi delivery/collection locations, atomic database stock reservation, simulated MTN Mobile Money, Airtel Money, Visa/Mastercard Demo, and Cash on Delivery with Success / Pending / Failed scenarios.
- **Receipts & Order Tracking**: Printable & downloadable PDFKit receipts generated exclusively for paid transactions, plus a 6-stage visual order progress tracker.
- **Administrator Retail BI Dashboard**: Collapsible dark-navy sidebar, 8 database-computed KPI cards, 7 interactive Recharts visualizations, product & category CRUD with Multer image upload, inventory adjustments with audit ledger, order status progression, customer role management, promotional slide/testimonial CMS, and CSV/PDF exports.

## Running Locally

1. Configure environment variables in `.env` (see `.env.example` for `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`).
2. Push schema to PostgreSQL: `npx drizzle-kit push --config=src/db/drizzle.config.ts`
3. Start development server: `npm run dev` (serves storefront + API on port `3000`).
4. Build production bundle: `npm run build` and `npm start`.

## Formal Test Matrix Summary

1. **TC-01 (Positive)**: Customer registration via `/auth` hashes password with `bcryptjs` and creates `customer` role record.
2. **TC-02 (Positive)**: Customer login / Google Sign-In verifies token and grants access to `/account`.
3. **TC-03 (Positive)**: Live search & category filter on `/catalog` queries PostgreSQL and returns matching UGX items.
4. **TC-04 (Positive)**: Adding items to basket and running `/api/cart/validate` verifies available inventory.
5. **TC-05 (Positive)**: Checkout + Simulated MTN Mobile Money `success` creates order, deducts stock atomically, and generates PDF receipt.
6. **TC-06 (Validation/Error)**: Simulated payment with `failed` outcome updates order to `failed` and blocks receipt creation (`400` / `404`).
7. **TC-07 (Validation/Error)**: Attempting to order more units than `quantity_on_hand` returns `409` and prevents overselling.
8. **TC-08 (Access Control)**: Customer token calling `/api/admin/analytics` or `/api/products` POST receives `403 Forbidden`.
