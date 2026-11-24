import {
  Apple,
  ArrowRight,
  Baby,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Croissant,
  Droplets,
  Home,
  ReceiptText,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Star,
  Truck,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard.tsx';
import { ProductImage } from '../components/ProductImage.tsx';
import { QuickViewModal } from '../components/QuickViewModal.tsx';
import { StorefrontLayout } from '../layouts/StorefrontLayout.tsx';
import { api } from '../services/api.ts';
import { ProductDTO } from '../utils/format.ts';

interface Banner {
  id: number;
  title: string;
  subtitle: string;
  badgeText: string;
  discountText: string;
  imageUrl: string;
  ctaText: string;
  ctaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  imageUrl: string;
  productCount: number;
}

interface Testimonial {
  id: number;
  customerName: string;
  roleOrLocation: string;
  rating: number;
  quote: string;
  isDemo: boolean;
}

interface HomeData {
  banners: Banner[];
  categories: Category[];
  featuredProducts: ProductDTO[];
  todaysDeals: ProductDTO[];
  weeklyOffers: ProductDTO[];
  bestSellers: ProductDTO[];
  newArrivals: ProductDTO[];
  testimonials: Testimonial[];
}

const CATEGORY_ICONS: Record<string, typeof ShoppingBasket> = {
  ShoppingBasket,
  Coffee,
  Apple,
  Croissant,
  Sparkles,
  Home,
  Zap,
  Baby,
  Droplets,
};

type PromoTab = 'featured' | 'todaysDeals' | 'weeklyOffers' | 'bestSellers' | 'newArrivals';

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [promoTab, setPromoTab] = useState<PromoTab>('featured');
  const [quickViewProduct, setQuickViewProduct] = useState<ProductDTO | null>(null);

  useEffect(() => {
    api
      .get('/storefront/home')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const slides = data?.banners || [];

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  const activeProducts: ProductDTO[] = data
    ? promoTab === 'featured'
      ? data.featuredProducts
      : promoTab === 'todaysDeals'
      ? data.todaysDeals
      : promoTab === 'weeklyOffers'
      ? data.weeklyOffers
      : promoTab === 'bestSellers'
      ? data.bestSellers
      : data.newArrivals
    : [];

  return (
    <StorefrontLayout>
      {/* 1. Dynamic Hero Promotional Carousel */}
      <section
        className="relative bg-[#0C284D] overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {loading ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
            <div className="h-[340px] rounded-xl bg-blue-950/60 animate-pulse" />
          </div>
        ) : slides.length > 0 ? (
          <div className="relative min-h-[440px] lg:min-h-[510px] flex items-center">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  idx === activeSlide ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
                }`}
              >
                <ProductImage
                  src={slide.imageUrl}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                />
                {/* Measured contrast scrim for 4.5:1+ legibility */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0C284D]/95 via-[#123B70]/80 to-[#0C284D]/30" />

                <div className="relative z-10 max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center">
                  <div className="max-w-2xl space-y-5 py-12">
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-[#38BDF8] uppercase tracking-wider">
                      <span>{slide.badgeText}</span>
                      {slide.discountText && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-white">{slide.discountText}</span>
                        </>
                      )}
                    </div>

                    <h1
                      className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-[1.12] tracking-tight"
                      style={{ textWrap: 'balance' }}
                    >
                      {slide.title}
                    </h1>

                    <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl">
                      {slide.subtitle}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <Link
                        to={slide.ctaLink}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#38BDF8] hover:text-[#0C284D] transition-colors"
                      >
                        <span>{slide.ctaText}</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        to={slide.secondaryCtaLink}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-white/30 bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors"
                      >
                        <span>{slide.secondaryCtaText}</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Carousel Controls */}
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length)}
                  aria-label="Previous slide"
                  className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/25 items-center justify-center hover:bg-white hover:text-[#123B70] transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlide((prev) => (prev + 1) % slides.length)}
                  aria-label="Next slide"
                  className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/25 items-center justify-center hover:bg-white hover:text-[#123B70] transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                  {slides.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSlide(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        idx === activeSlide ? 'w-8 bg-[#38BDF8]' : 'w-2.5 bg-white/45 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}
      </section>

      {/* 2. Category Discovery Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-6">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider">
              Active Supermarket Kabale Aisles
            </p>
            <h2 className="font-display text-2xl font-bold text-[#172B4D] mt-1">
              Shop by Department
            </h2>
          </div>
          <Link
            to="/catalog"
            className="text-sm font-semibold text-[#2563EB] hover:text-[#123B70] inline-flex items-center gap-1 whitespace-nowrap"
          >
            <span>All Departments</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {(data?.categories || []).map((cat) => {
            const Icon = CATEGORY_ICONS[cat.iconName] || ShoppingBasket;
            return (
              <Link
                key={cat.id}
                to={`/catalog?category=${cat.slug}`}
                className="group bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3.5 hover:border-[#2563EB] hover:shadow-sm transition-all"
              >
                <span className="h-11 w-11 rounded-lg bg-[#EAF3FF] text-[#123B70] group-hover:bg-[#2563EB] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold text-[#172B4D] truncate">
                    {cat.name}
                  </div>
                  <div className="text-xs text-[#64748B] tabular-nums">
                    {cat.productCount} {cat.productCount === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Curated Promotional & Featured Product Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-7">
          <div>
            <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider">
              Curated Storefront Selection
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] mt-1">
              Featured Products & Supermarket Deals
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
            {[
              { key: 'featured', label: 'Featured' },
              { key: 'todaysDeals', label: "Today's Deals" },
              { key: 'weeklyOffers', label: 'Weekly Offers' },
              { key: 'bestSellers', label: 'Best Sellers' },
              { key: 'newArrivals', label: 'New Arrivals' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPromoTab(tab.key as PromoTab)}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  promoTab === tab.key
                    ? 'bg-[#123B70] text-white'
                    : 'text-[#64748B] hover:text-[#172B4D]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-80 rounded-xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {activeProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onQuickView={setQuickViewProduct}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Store Benefits & Shopping Promise */}
      <section className="bg-white border-y border-slate-200 py-12 my-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Truck,
                title: 'Same-Day Kabale Delivery',
                desc: 'Scheduled dispatch across Kigongi, Makanga, Kikungiri, Nyabikoni, and free store pickup.',
              },
              {
                icon: ShieldCheck,
                title: 'Simulated Mobile Money',
                desc: 'Test MTN Mobile Money, Airtel Money, Card Demo, and Cash on Delivery safely.',
              },
              {
                icon: ReceiptText,
                title: 'Instant PDF Receipts',
                desc: 'Download or print official Active Supermarket Kabale receipts after successful payments.',
              },
              {
                icon: ShoppingBasket,
                title: 'Live Stock Accuracy',
                desc: 'Real-time database inventory checks prevent overselling during online checkout.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3.5">
                  <div className="h-11 w-11 rounded-lg bg-[#EAF3FF] text-[#123B70] flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#172B4D]">{item.title}</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed mt-1">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Customer Testimonials (Demonstration Reviews) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-7">
          <div>
            <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider">
              Kabale Community Feedback · Demonstration Reviews
            </p>
            <h2 className="font-display text-2xl font-bold text-[#172B4D] mt-1">
              Trusted by Households & Businesses in Kabale
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {(data?.testimonials || []).map((t) => (
            <article
              key={t.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-1 text-[#F59E0B] mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-[#172B4D] leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="font-display text-sm font-bold text-[#123B70]">{t.customerName}</div>
                <div className="text-xs text-[#64748B]">{t.roleOrLocation}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 6. Strong Storefront CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-[#123B70] rounded-xl p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 text-white">
          <div className="max-w-2xl space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Ready to fill your basket at Active Supermarket Kabale?
            </h2>
            <p className="text-sm sm:text-base text-blue-100">
              Enjoy free Kabale Town delivery on orders above UGX 150,000 or pick up at Main Street in 45 minutes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#38BDF8] hover:text-[#0C284D] transition-colors"
            >
              <span>Start Shopping</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/track"
              className="px-5 py-3 rounded-lg border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              Track an Order
            </Link>
          </div>
        </div>
      </section>

      <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </StorefrontLayout>
  );
}
