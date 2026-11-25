import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  deliveryLocations,
  inventory,
  inventoryMovements,
  notifications,
  orderItems,
  orders,
  payments,
  products,
  promotionalBanners,
  receipts,
  reviews,
  storeSettings,
  testimonials,
  users,
} from './schema.ts';

let seedPromise: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Database seed failed:', err);
    });
  }
  return seedPromise;
}

async function runSeed() {
  const [{ total: catCount }] = await db.select({ total: count() }).from(categories);
  if (catCount > 0) {
    return;
  }

  console.log('Seeding MarketSphere Active Supermarket Kabale database...');

  // 1. Store settings
  await db
    .insert(storeSettings)
    .values([
      { key: 'cod_enabled', value: 'true' },
      { key: 'free_delivery_threshold_ugx', value: '150000' },
      {
        key: 'announcement_text',
        value:
          'Same-day delivery across Kabale Town · Free Store Collection at Main Street Branch · Support: +256 772 480 120',
      },
    ])
    .onConflictDoNothing();

  // 2. Delivery locations (Kabale & Southwestern Uganda)
  const insertedLocations = await db
    .insert(deliveryLocations)
    .values([
      {
        name: 'Active Supermarket Kabale — Main Street Branch (Pickup)',
        region: 'Kabale Municipality',
        deliveryType: 'collection',
        feeUgx: 0,
        estimatedWindow: 'Ready in 45 mins',
        isActive: true,
      },
      {
        name: 'Kabale Central / Kigongi / Garage Street',
        region: 'Kabale Municipality',
        deliveryType: 'delivery',
        feeUgx: 3000,
        estimatedWindow: '1–2 hours',
        isActive: true,
      },
      {
        name: 'Makanga Hill & Kabale Regional Hospital Zone',
        region: 'Kabale Municipality',
        deliveryType: 'delivery',
        feeUgx: 4000,
        estimatedWindow: '2–3 hours',
        isActive: true,
      },
      {
        name: 'Kikungiri & Bishop Barham University Area',
        region: 'Kabale Municipality',
        deliveryType: 'delivery',
        feeUgx: 4500,
        estimatedWindow: '2–3 hours',
        isActive: true,
      },
      {
        name: 'Nyabikoni & Kabale University Campus',
        region: 'Kabale Municipality',
        deliveryType: 'delivery',
        feeUgx: 5000,
        estimatedWindow: '2–4 hours',
        isActive: true,
      },
      {
        name: 'Kisoro / Rubanda / Ntungamo Town Courier',
        region: 'Kigezi Sub-Region',
        deliveryType: 'delivery',
        feeUgx: 12000,
        estimatedWindow: 'Next-day dispatch',
        isActive: true,
      },
    ])
    .returning();

  // 3. Categories (9 core supermarket categories)
  const insertedCategories = await db
    .insert(categories)
    .values([
      {
        name: 'Groceries',
        slug: 'groceries',
        description: 'Rice, maize flour, cooking oils, sugar, honey, and everyday dry pantry staples.',
        iconName: 'ShoppingBasket',
        imageUrl: '/src/assets/images/prod_pantry_staples_1795549634803.jpg',
        sortOrder: 1,
      },
      {
        name: 'Beverages',
        slug: 'beverages',
        description: 'Ugandan Arabica coffee, highland teas, mineral water, fruit juices, and sodas.',
        iconName: 'Coffee',
        imageUrl: '/src/assets/images/hero_pantry_showcase_1795549633774.jpg',
        sortOrder: 2,
      },
      {
        name: 'Fresh Foods',
        slug: 'fresh-foods',
        description: 'Farm-fresh Kigezi highland vegetables, fruits, matooke, eggs, and chilled meats.',
        iconName: 'Apple',
        imageUrl: '/src/assets/images/hero_fresh_harvest_1795549633163.jpg',
        sortOrder: 3,
      },
      {
        name: 'Bakery',
        slug: 'bakery',
        description: 'Freshly baked sourdough loaves, sweet buns, croissants, and celebration cakes.',
        iconName: 'Croissant',
        imageUrl: '/src/assets/images/hero_bakery_dairy_1795549633862.jpg',
        sortOrder: 4,
      },
      {
        name: 'Personal Care',
        slug: 'personal-care',
        description: 'Botanical lotions, raw shea butter, bathing soaps, dental care, and grooming.',
        iconName: 'Sparkles',
        imageUrl: '/src/assets/images/prod_personal_care_1795549634992.jpg',
        sortOrder: 5,
      },
      {
        name: 'Household Essentials',
        slug: 'household-essentials',
        description: 'Kitchen towels, food storage containers, batteries, bulbs, and home basics.',
        iconName: 'Home',
        imageUrl: '/src/assets/images/prod_home_appliances_1795549638683.jpg',
        sortOrder: 6,
      },
      {
        name: 'Electronics & Accessories',
        slug: 'electronics-accessories',
        description: 'Electric kettles, blenders, surge protectors, USB cables, and power banks.',
        iconName: 'Zap',
        imageUrl: '/src/assets/images/prod_home_appliances_1795549638683.jpg',
        sortOrder: 7,
      },
      {
        name: 'Baby Products',
        slug: 'baby-products',
        description: 'Gentle infant diapers, baby wipes, fortified porridge, and mild baby lotion.',
        iconName: 'Baby',
        imageUrl: '/src/assets/images/prod_personal_care_1795549634992.jpg',
        sortOrder: 8,
      },
      {
        name: 'Cleaning Supplies',
        slug: 'cleaning-supplies',
        description: 'Laundry detergents, dishwashing liquids, disinfectants, mops, and surface sprays.',
        iconName: 'Droplets',
        imageUrl: '/src/assets/images/hero_pantry_showcase_1795549633774.jpg',
        sortOrder: 9,
      },
    ])
    .returning();

  const catMap = new Map(insertedCategories.map((c) => [c.slug, c.id]));

  // 4. Products (18 realistic Kabale supermarket items in UGX)
  const productSeeds = [
    {
      categoryId: catMap.get('groceries')!,
      sku: 'ASK-GRC-001',
      name: 'Kigezi Highland Basmati Rice (5 kg)',
      slug: 'kigezi-highland-basmati-rice-5kg',
      description:
        'Long-grain aromatic basmati rice packed cleanly for family meals, pilau, and everyday household cooking.',
      specifications: { Weight: '5 kg', Origin: 'East Africa', Packaging: 'Sealed Woven Sack', 'Shelf Life': '12 Months' },
      priceUgx: 34000,
      discountPriceUgx: 29500,
      imageUrl: '/src/assets/images/prod_pantry_staples_1795549634803.jpg',
      isFeatured: true,
      promoTag: 'todays_deal',
      ratingAvg: 4.8,
      reviewCount: 3,
      stock: 48,
      threshold: 12,
    },
    {
      categoryId: catMap.get('groceries')!,
      sku: 'ASK-GRC-002',
      name: 'Pure Golden Sunflower Cooking Oil (2 Litres)',
      slug: 'pure-golden-sunflower-cooking-oil-2l',
      description:
        'Cholesterol-free cold-pressed sunflower oil ideal for crisp frying, sautéing, and everyday baking.',
      specifications: { Volume: '2 Litres', Fortification: 'Vitamin A & D', Container: 'Tamper-evident PET' },
      priceUgx: 24500,
      discountPriceUgx: 21900,
      imageUrl: '/src/assets/images/hero_pantry_showcase_1795549633774.jpg',
      isFeatured: true,
      promoTag: 'best_seller',
      ratingAvg: 4.7,
      reviewCount: 2,
      stock: 64,
      threshold: 15,
    },
    {
      categoryId: catMap.get('groceries')!,
      sku: 'ASK-GRC-003',
      name: 'Great Rift Pure Acacia Raw Honey (450g)',
      slug: 'great-rift-pure-acacia-raw-honey-450g',
      description:
        'Unfiltered golden highland acacia honey harvested from Kigezi apiaries. Rich floral aroma and natural sweetness.',
      specifications: { 'Net Weight': '450g', Grade: '100% Pure Raw', Jar: 'Reusable Glass' },
      priceUgx: 22000,
      discountPriceUgx: null,
      imageUrl: '/src/assets/images/prod_pantry_staples_1795549634803.jpg',
      isFeatured: true,
      promoTag: 'new_arrival',
      ratingAvg: 4.9,
      reviewCount: 2,
      stock: 8, // low stock!
      threshold: 10,
    },
    {
      categoryId: catMap.get('beverages')!,
      sku: 'ASK-BEV-001',
      name: 'Bukwo Peak Ugandan Arabica Roast Coffee (340g)',
      slug: 'bukwo-peak-ugandan-arabica-coffee-340g',
      description:
        'Single-origin medium-roast Arabica coffee with vibrant notes of dark chocolate and ripe berries.',
      specifications: { Weight: '340g', Roast: 'Medium Whole/Ground', Origin: 'Mt. Elgon, Uganda' },
      priceUgx: 28000,
      discountPriceUgx: 24000,
      imageUrl: '/src/assets/images/prod_pantry_staples_1795549634803.jpg',
      isFeatured: true,
      promoTag: 'weekly_offer',
      ratingAvg: 4.9,
      reviewCount: 2,
      stock: 32,
      threshold: 10,
    },
    {
      categoryId: catMap.get('beverages')!,
      sku: 'ASK-BEV-002',
      name: 'Rwenzori Natural Mineral Water (12 x 500ml Pack)',
      slug: 'rwenzori-natural-mineral-water-12-pack',
      description: 'Crisp mountain-filtered mineral water case convenient for offices, events, and family hydration.',
      specifications: { Pack: '12 Bottles x 500ml', Source: 'Rwenzori Mountains' },
      priceUgx: 14500,
      discountPriceUgx: null,
      imageUrl: '/src/assets/images/hero_pantry_showcase_1795549633774.jpg',
      isFeatured: false,
      promoTag: 'best_seller',
      ratingAvg: 4.8,
      reviewCount: 1,
      stock: 90,
      threshold: 20,
    },
    {
      categoryId: catMap.get('fresh-foods')!,
      sku: 'ASK-FRS-001',
      name: 'Kigezi Farm Fresh Avocados (Net of 6)',
      slug: 'kigezi-farm-fresh-avocados-6-pack',
      description: 'Creamy, hand-selected Hass and Fuerte avocados picked fresh from Kabale valley farms.',
      specifications: { Quantity: '6 Large Fruits', Harvest: 'Daily Local Delivery' },
      priceUgx: 9000,
      discountPriceUgx: 7500,
      imageUrl: '/src/assets/images/hero_fresh_harvest_1795549633163.jpg',
      isFeatured: true,
      promoTag: 'todays_deal',
      ratingAvg: 4.7,
      reviewCount: 2,
      stock: 40,
      threshold: 10,
    },
    {
      categoryId: catMap.get('fresh-foods')!,
      sku: 'ASK-FRS-002',
      name: 'Sweet Golden Pineapples (2 Large)',
      slug: 'sweet-golden-pineapples-2-pack',
      description: 'Juicy sun-ripened Ugandan pineapples with high natural sweetness, ready to slice or juice.',
      specifications: { Quantity: '2 Whole Pineapples', Grade: 'Export Quality A' },
      priceUgx: 11000,
      discountPriceUgx: null,
      imageUrl: '/src/assets/images/hero_fresh_harvest_1795549633163.jpg',
      isFeatured: false,
      promoTag: 'weekly_offer',
      ratingAvg: 4.6,
      reviewCount: 1,
      stock: 25,
      threshold: 8,
    },
    {
      categoryId: catMap.get('fresh-foods')!,
      sku: 'ASK-FRS-003',
      name: 'Farm-Fresh Brown Eggs Tray (30 Eggs)',
      slug: 'farm-fresh-brown-eggs-tray-30',
      description: 'Grade-A large brown eggs packed in protective fibre trays from free-range Kigezi poultry farms.',
      specifications: { Count: '30 Eggs', Storage: 'Keep Cool & Dry' },
      priceUgx: 16500,
      discountPriceUgx: 15000,
      imageUrl: '/src/assets/images/hero_bakery_dairy_1795549633862.jpg',
      isFeatured: true,
      promoTag: 'best_seller',
      ratingAvg: 4.9,
      reviewCount: 3,
      stock: 7, // low stock!
      threshold: 12,
    },
    {
      categoryId: catMap.get('bakery')!,
      sku: 'ASK-BKR-001',
      name: 'Artisan Farmhouse Sourdough Boule (800g)',
      slug: 'artisan-farmhouse-sourdough-boule-800g',
      description: 'Slow-fermented crusty sourdough bread baked every morning in our Kabale in-store bakery.',
      specifications: { Weight: '800g', Baked: 'Daily at 06:30 AM', Allergens: 'Wheat Gluten' },
      priceUgx: 12000,
      discountPriceUgx: null,
      imageUrl: '/src/assets/images/hero_bakery_dairy_1795549633862.jpg',
      isFeatured: true,
      promoTag: 'new_arrival',
      ratingAvg: 4.8,
      reviewCount: 2,
      stock: 18,
      threshold: 6,
    },
    {
      categoryId: catMap.get('bakery')!,
      sku: 'ASK-BKR-002',
      name: 'All-Butter Golden Croissants (Box of 4)',
      slug: 'all-butter-golden-croissants-4-pack',
      description: 'Flaky, layered French-style breakfast croissants crafted with Ugandan highland cultured butter.',
      specifications: { Count: '4 Croissants', Serving: 'Best warmed 2 mins' },
      priceUgx: 15000,
      discountPriceUgx: 13000,
      imageUrl: '/src/assets/images/hero_bakery_dairy_1795549633862.jpg',
      isFeatured: false,
      promoTag: 'todays_deal',
      ratingAvg: 4.7,
      reviewCount: 1,
      stock: 0, // out of stock!
      threshold: 6,
    },
    {
      categoryId: catMap.get('personal-care')!,
      sku: 'ASK-PRC-001',
      name: 'Botanical Shea & Bergamot Hydrating Lotion (250ml)',
      slug: 'botanical-shea-bergamot-lotion-250ml',
      description: 'Fast-absorbing daily body lotion enriched with cold-pressed East African shea butter and bergamot oil.',
      specifications: { Volume: '250ml', 'Skin Type': 'All Skin Types', Paraben: 'Paraben-Free' },
      priceUgx: 32000,
      discountPriceUgx: 27500,
      imageUrl: '/src/assets/images/prod_personal_care_1795549634992.jpg',
      isFeatured: true,
      promoTag: 'weekly_offer',
      ratingAvg: 4.8,
      reviewCount: 2,
      stock: 28,
      threshold: 8,
    },
    {
      categoryId: catMap.get('personal-care')!,
      sku: 'ASK-PRC-002',
      name: 'Raw Unrefined Shea Butter Balm (120g)',
      slug: 'raw-unrefined-shea-butter-balm-120g',
      description: 'Deeply nourishing whipped shea butter balm for dry skin, lips, and natural hair care.',
      specifications: { Weight: '120g', Scent: 'Orange Blossom' },
      priceUgx: 26000,
      discountPriceUgx: null,
      imageUrl: '/src/assets/images/prod_personal_care_1795549634992.jpg',
      isFeatured: false,
      promoTag: 'new_arrival',
      ratingAvg: 4.9,
      reviewCount: 1,
      stock: 22,
      threshold: 8,
    },
    {
      categoryId: catMap.get('electronics-accessories')!,
      sku: 'ASK-ELC-001',
      name: 'Aura Brushed Stainless Electric Kettle (1.7L)',
      slug: 'aura-stainless-electric-kettle-1-7l',
      description:
        'Rapid-boil 2200W cordless stainless steel kettle with auto shut-off, boil-dry protection, and 360-degree base.',
      specifications: { Capacity: '1.7 Litres', Power: '2200W / 240V', Warranty: '12 Months Store Warranty' },
      priceUgx: 135000,
      discountPriceUgx: 118000,
      imageUrl: '/src/assets/images/prod_home_appliances_1795549638683.jpg',
      isFeatured: true,
      promoTag: 'todays_deal',
      ratingAvg: 4.8,
      reviewCount: 2,
      stock: 14,
      threshold: 5,
    },
    {
      categoryId: catMap.get('electronics-accessories')!,
      sku: 'ASK-ELC-002',
      name: 'Aura Glass Jar Countertop Blender (1.25L)',
      slug: 'aura-glass-jar-countertop-blender',
      description:
        'Heavy-duty 4-speed kitchen blender with pulse mode and stainless blades for smoothies, soups, and spices.',
      specifications: { Capacity: '1.25 Litres', Speeds: '4 + Pulse', Material: 'Tempered Glass Jar' },
      priceUgx: 185000,
      discountPriceUgx: 165000,
      imageUrl: '/src/assets/images/prod_home_appliances_1795549638683.jpg',
      isFeatured: true,
      promoTag: 'best_seller',
      ratingAvg: 4.7,
      reviewCount: 2,
      stock: 6, // low stock!
      threshold: 8,
    },
    {
      categoryId: catMap.get('household-essentials')!,
      sku: 'ASK-HSD-001',
      name: 'Heavy-Duty Surge Protector 4-Way Extension (3m)',
      slug: 'heavy-duty-surge-protector-4-way-3m',
      description: 'UK 3-pin fused extension bar with individual switches and lightning surge protection.',
      specifications: { Sockets: '4 x UK 13A', Cable: '3 Metres', Protection: '13A Fused' },
      priceUgx: 42000,
      discountPriceUgx: null,
      imageUrl: '/src/assets/images/prod_home_appliances_1795549638683.jpg',
      isFeatured: false,
      promoTag: null,
      ratingAvg: 4.5,
      reviewCount: 1,
      stock: 30,
      threshold: 10,
    },
    {
      categoryId: catMap.get('baby-products')!,
      sku: 'ASK-BBY-001',
      name: 'SoftCare Ultra-Dry Baby Diapers (Size 4, 44 Count)',
      slug: 'softcare-ultra-dry-baby-diapers-size-4',
      description: 'Breathable 12-hour leak-guard diapers with soft cotton-feel waistband for active toddlers.',
      specifications: { Size: 'Size 4 (9–14 kg)', Count: '44 Diapers' },
      priceUgx: 46000,
      discountPriceUgx: 41500,
      imageUrl: '/src/assets/images/prod_personal_care_1795549634992.jpg',
      isFeatured: true,
      promoTag: 'weekly_offer',
      ratingAvg: 4.9,
      reviewCount: 2,
      stock: 36,
      threshold: 10,
    },
    {
      categoryId: catMap.get('cleaning-supplies')!,
      sku: 'ASK-CLN-001',
      name: 'FreshGuard Multi-Surface Disinfectant Liquid (2L)',
      slug: 'freshguard-multi-surface-disinfectant-2l',
      description: 'Pine-scented concentrated surface cleaner formulated for kitchens, tiles, and bathroom hygiene.',
      specifications: { Volume: '2 Litres', Fragrance: 'Highland Pine' },
      priceUgx: 19500,
      discountPriceUgx: 17000,
      imageUrl: '/src/assets/images/hero_pantry_showcase_1795549633774.jpg',
      isFeatured: false,
      promoTag: 'best_seller',
      ratingAvg: 4.6,
      reviewCount: 1,
      stock: 44,
      threshold: 10,
    },
    {
      categoryId: catMap.get('groceries')!,
      sku: 'ASK-GRC-004',
      name: 'Supreme Maize Flour Sifted Grade 1 (5 kg)',
      slug: 'supreme-maize-flour-sifted-5kg',
      description: 'Fine, fortified white maize meal milled for smooth posho and family porridge.',
      specifications: { Weight: '5 kg', Fortification: 'Iron & Zinc' },
      priceUgx: 18500,
      discountPriceUgx: null,
      imageUrl: '/src/assets/images/prod_pantry_staples_1795549634803.jpg',
      isFeatured: false,
      promoTag: null,
      ratingAvg: 4.7,
      reviewCount: 1,
      stock: 55,
      threshold: 15,
    },
  ];

  const insertedProducts: Array<typeof products.$inferSelect> = [];
  for (const item of productSeeds) {
    const { stock, threshold, ...prodData } = item;
    const [prod] = await db
      .insert(products)
      .values({
        ...prodData,
        specifications: prodData.specifications as unknown as Record<string, string>,
      })
      .returning();
    insertedProducts.push(prod);

    await db.insert(inventory).values({
      productId: prod.id,
      quantityOnHand: stock,
      reservedQuantity: 0,
      lowStockThreshold: threshold,
    });

    await db.insert(inventoryMovements).values({
      productId: prod.id,
      movementType: 'restock',
      quantityDelta: stock,
      balanceAfter: stock,
      referenceType: 'initial_stock',
      note: 'Opening store stock at Active Supermarket Kabale',
    });
  }

  // 5. Promotional Banners (Hero Carousel)
  await db.insert(promotionalBanners).values([
    {
      title: 'Fresh Kigezi Harvest, Delivered Same Day in Kabale',
      subtitle:
        'Order farm-picked avocados, crisp highland vegetables, and daily breakfast essentials straight from Active Supermarket Kabale.',
      badgeText: 'Fresh Harvest',
      discountText: 'Up to 18% Off Produce',
      imageUrl: '/src/assets/images/hero_fresh_harvest_1795549633163.jpg',
      ctaText: 'Shop Fresh Foods',
      ctaLink: '/catalog?category=fresh-foods',
      secondaryCtaText: 'Explore Categories',
      secondaryCtaLink: '/catalog',
      sortOrder: 1,
      isActive: true,
    },
    {
      title: 'Stock Your Pantry with Ugandan Staples & Single-Origin Coffee',
      subtitle:
        'Save on 5kg Basmati Rice, Pure Sunflower Oil, Acacia Honey, and Bukwo Peak Arabica coffee with convenient store pickup or home drop-off.',
      badgeText: 'Weekly Pantry Savings',
      discountText: 'Save UGX 4,500 on Staples',
      imageUrl: '/src/assets/images/hero_pantry_showcase_1795549633774.jpg',
      ctaText: 'Shop Groceries',
      ctaLink: '/catalog?category=groceries',
      secondaryCtaText: 'View Weekly Offers',
      secondaryCtaLink: '/catalog?promo=weekly_offer',
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'Morning Bakery Loaves & Kitchen Appliances Now Online',
      subtitle:
        'From warm sourdough boules baked at 06:30 AM to stainless steel electric kettles and blenders backed by our 12-month branch warranty.',
      badgeText: 'In-Store Bakery & Home',
      discountText: 'Free Pickup at Main Street',
      imageUrl: '/src/assets/images/hero_bakery_dairy_1795549633862.jpg',
      ctaText: 'Browse All Products',
      ctaLink: '/catalog',
      secondaryCtaText: 'Kitchen Electronics',
      secondaryCtaLink: '/catalog?category=electronics-accessories',
      sortOrder: 3,
      isActive: true,
    },
  ]);

  // 6. Demo Testimonials (explicitly marked as demonstration reviews)
  await db.insert(testimonials).values([
    {
      customerName: 'Ainomugisha Grace',
      roleOrLocation: 'Makanga Hill, Kabale',
      rating: 5,
      quote:
        'Ordering weekly groceries online from Active Supermarket Kabale saves me the afternoon traffic along Main Street. My delivery arrived in under two hours with a clean PDF receipt.',
      isDemo: true,
      isActive: true,
    },
    {
      customerName: 'Tumwesigye Ivan',
      roleOrLocation: 'Kabale University Staff',
      rating: 5,
      quote:
        'I love placing an order between lectures and collecting it packed at the Main Street pickup counter. Stock availability is accurate and Mobile Money checkout works smoothly.',
      isDemo: true,
      isActive: true,
    },
    {
      customerName: 'Kiconco Sarah',
      roleOrLocation: 'Kigongi Residence, Kabale',
      rating: 5,
      quote:
        'The fresh produce and bakery loaves are consistently crisp and well-packaged. Being able to track my order status step by step gives great peace of mind.',
      isDemo: true,
      isActive: true,
    },
    {
      customerName: 'Byaruhanga Moses',
      roleOrLocation: 'Kikungiri Business Owner',
      rating: 4,
      quote:
        'We buy mineral water packs and cleaning supplies for our guesthouse every fortnight. Having downloadable receipts makes our bookkeeping much faster.',
      isDemo: true,
      isActive: true,
    },
  ]);

  // 7. Sample Customer Profiles (non-sensitive demo records without credentials)
  const sampleCustomers = await db
    .insert(users)
    .values([
      {
        fullName: 'Ainomugisha Grace',
        email: 'grace.demo@kabale-shopper.example',
        phone: '+256 772 110 201',
        role: 'customer',
        status: 'active',
      },
      {
        fullName: 'Tumwesigye Ivan',
        email: 'ivan.demo@kabale-shopper.example',
        phone: '+256 752 330 402',
        role: 'customer',
        status: 'active',
      },
      {
        fullName: 'Kiconco Sarah',
        email: 'sarah.demo@kabale-shopper.example',
        phone: '+256 782 550 603',
        role: 'customer',
        status: 'active',
      },
      {
        fullName: 'Byaruhanga Moses',
        email: 'moses.demo@kabale-shopper.example',
        phone: '+256 701 770 804',
        role: 'customer',
        status: 'active',
      },
    ])
    .returning();

  // 8. Sample Product Reviews
  await db.insert(reviews).values([
    {
      productId: insertedProducts[0].id,
      userId: sampleCustomers[0].id,
      authorName: 'Ainomugisha Grace',
      rating: 5,
      comment: 'Very clean grain, cooks evenly without sticking. Great family size.',
    },
    {
      productId: insertedProducts[3].id,
      userId: sampleCustomers[1].id,
      authorName: 'Tumwesigye Ivan',
      rating: 5,
      comment: 'Rich aroma and smooth finish. Easily the best roasted Ugandan coffee on the shelf.',
    },
    {
      productId: insertedProducts[12].id,
      userId: sampleCustomers[3].id,
      authorName: 'Byaruhanga Moses',
      rating: 5,
      comment: 'Boils fast and the brushed steel finish looks smart in our office kitchen.',
    },
  ]);

  // 9. Historical Orders, Payments & Receipts across the last 28 days for real BI analytics
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);

  const historicalSpecs = [
    {
      days: 26,
      customer: sampleCustomers[0],
      loc: insertedLocations[2],
      status: 'Delivered',
      paymentStatus: 'paid',
      method: 'mtn_momo',
      items: [
        { prod: insertedProducts[0], qty: 2 },
        { prod: insertedProducts[1], qty: 1 },
      ],
    },
    {
      days: 22,
      customer: sampleCustomers[1],
      loc: insertedLocations[0],
      status: 'Delivered',
      paymentStatus: 'paid',
      method: 'airtel_money',
      items: [
        { prod: insertedProducts[3], qty: 2 },
        { prod: insertedProducts[8], qty: 1 },
      ],
    },
    {
      days: 19,
      customer: sampleCustomers[2],
      loc: insertedLocations[1],
      status: 'Delivered',
      paymentStatus: 'paid',
      method: 'card_demo',
      items: [
        { prod: insertedProducts[10], qty: 1 },
        { prod: insertedProducts[15], qty: 2 },
      ],
    },
    {
      days: 15,
      customer: sampleCustomers[3],
      loc: insertedLocations[3],
      status: 'Delivered',
      paymentStatus: 'paid',
      method: 'mtn_momo',
      items: [
        { prod: insertedProducts[4], qty: 4 },
        { prod: insertedProducts[16], qty: 3 },
      ],
    },
    {
      days: 12,
      customer: sampleCustomers[0],
      loc: insertedLocations[2],
      status: 'Delivered',
      paymentStatus: 'paid',
      method: 'mtn_momo',
      items: [
        { prod: insertedProducts[12], qty: 1 },
        { prod: insertedProducts[5], qty: 2 },
      ],
    },
    {
      days: 9,
      customer: sampleCustomers[1],
      loc: insertedLocations[4],
      status: 'Cancelled',
      paymentStatus: 'failed',
      method: 'airtel_money',
      items: [{ prod: insertedProducts[13], qty: 1 }],
    },
    {
      days: 7,
      customer: sampleCustomers[2],
      loc: insertedLocations[1],
      status: 'Delivered',
      paymentStatus: 'paid',
      method: 'mtn_momo',
      items: [
        { prod: insertedProducts[7], qty: 2 },
        { prod: insertedProducts[2], qty: 1 },
        { prod: insertedProducts[8], qty: 2 },
      ],
    },
    {
      days: 4,
      customer: sampleCustomers[3],
      loc: insertedLocations[3],
      status: 'Out for delivery',
      paymentStatus: 'paid',
      method: 'card_demo',
      items: [
        { prod: insertedProducts[13], qty: 1 },
        { prod: insertedProducts[14], qty: 1 },
      ],
    },
    {
      days: 2,
      customer: sampleCustomers[0],
      loc: insertedLocations[0],
      status: 'Ready for collection',
      paymentStatus: 'paid',
      method: 'airtel_money',
      items: [
        { prod: insertedProducts[0], qty: 1 },
        { prod: insertedProducts[6], qty: 2 },
      ],
    },
    {
      days: 1,
      customer: sampleCustomers[1],
      loc: insertedLocations[4],
      status: 'Processing',
      paymentStatus: 'paid',
      method: 'mtn_momo',
      items: [
        { prod: insertedProducts[15], qty: 2 },
        { prod: insertedProducts[1], qty: 2 },
      ],
    },
    {
      days: 0,
      customer: sampleCustomers[2],
      loc: insertedLocations[1],
      status: 'Pending',
      paymentStatus: 'pending',
      method: 'cash_on_delivery',
      items: [
        { prod: insertedProducts[5], qty: 2 },
        { prod: insertedProducts[17], qty: 1 },
      ],
    },
  ];

  for (let idx = 0; idx < historicalSpecs.length; idx++) {
    const spec = historicalSpecs[idx];
    const orderDate = daysAgo(spec.days);
    const subtotal = spec.items.reduce(
      (acc, i) => acc + (i.prod.discountPriceUgx ?? i.prod.priceUgx) * i.qty,
      0
    );
    const deliveryFee = subtotal >= 150000 ? 0 : spec.loc.feeUgx;
    const total = subtotal + deliveryFee;
    const orderNumber = `MS-KBL-${202600 + idx + 1}`;

    const [createdOrder] = await db
      .insert(orders)
      .values({
        orderNumber,
        userId: spec.customer.id,
        customerName: spec.customer.fullName,
        customerEmail: spec.customer.email,
        customerPhone: spec.customer.phone,
        fulfillmentMethod: spec.loc.deliveryType,
        deliveryLocationId: spec.loc.id,
        deliveryLocationName: spec.loc.name,
        deliveryAddressText:
          spec.loc.deliveryType === 'collection'
            ? 'Counter Collection — Active Supermarket Kabale Main Street'
            : `${spec.loc.name}, Plot ${12 + idx}`,
        subtotalUgx: subtotal,
        deliveryFeeUgx: deliveryFee,
        totalUgx: total,
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        createdAt: orderDate,
        updatedAt: orderDate,
      })
      .returning();

    const itemRows = spec.items.map((i) => {
      const unitPrice = i.prod.discountPriceUgx ?? i.prod.priceUgx;
      return {
        orderId: createdOrder.id,
        productId: i.prod.id,
        productName: i.prod.name,
        productSku: i.prod.sku,
        unitPriceUgx: unitPrice,
        quantity: i.qty,
        lineTotalUgx: unitPrice * i.qty,
      };
    });

    await db.insert(orderItems).values(itemRows);

    const txRef = `SIM-${spec.method.toUpperCase().slice(0, 3)}-${100040 + idx}`;
    const [createdPayment] = await db
      .insert(payments)
      .values({
        orderId: createdOrder.id,
        method: spec.method,
        transactionRef: txRef,
        amountUgx: total,
        status: spec.paymentStatus,
        simulatedAccountMask: spec.method === 'card_demo' ? '•••• 4242' : spec.customer.phone,
        failureReason: spec.paymentStatus === 'failed' ? 'Insufficient wallet balance' : null,
        paidAt: spec.paymentStatus === 'paid' ? orderDate : null,
        createdAt: orderDate,
      })
      .returning();

    if (spec.paymentStatus === 'paid') {
      const receiptNumber = `RCP-ASK-${202600 + idx + 1}`;
      await db.insert(receipts).values({
        receiptNumber,
        orderId: createdOrder.id,
        paymentId: createdPayment.id,
        issuedAt: orderDate,
        snapshotJson: {
          receiptNumber,
          orderNumber,
          organisation: 'Active Supermarket Kabale',
          systemName: 'MarketSphere',
          customerName: spec.customer.fullName,
          customerEmail: spec.customer.email,
          customerPhone: spec.customer.phone,
          fulfillmentMethod: spec.loc.deliveryType,
          deliveryLocationName: spec.loc.name,
          items: itemRows,
          subtotalUgx: subtotal,
          deliveryFeeUgx: deliveryFee,
          totalUgx: total,
          paymentMethod: spec.method,
          transactionRef: txRef,
          paymentStatus: 'paid',
          issuedAt: orderDate.toISOString(),
        },
      });
    }
  }

  // 10. Initial admin notifications for low-stock & new order alerts
  await db.insert(notifications).values([
    {
      roleTarget: 'admin',
      title: 'Low Stock Alert: Great Rift Acacia Honey',
      message: 'Only 8 units remaining in stock (threshold: 10 units).',
    },
    {
      roleTarget: 'admin',
      title: 'Out of Stock: All-Butter Golden Croissants',
      message: 'Bakery inventory reached 0 units. Schedule morning batch restock.',
    },
    {
      roleTarget: 'admin',
      title: 'New Order Received: MS-KBL-202611',
      message: 'Pending Cash on Delivery order from Kiconco Sarah (Kabale Central).',
    },
  ]);

  console.log('MarketSphere seed complete.');
}
