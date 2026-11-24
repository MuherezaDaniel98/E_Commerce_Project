import {
  Heart,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  Phone,
  Search,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { CartDrawer } from '../components/CartDrawer.tsx';
import { ProductImage } from '../components/ProductImage.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { api } from '../services/api.ts';
import { formatUgx } from '../utils/format.ts';

interface Suggestion {
  id: number;
  name: string;
  slug: string;
  priceUgx: number;
  discountPriceUgx: number | null;
  imageUrl: string;
  categoryName: string;
}

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { totalCount, setDrawerOpen, wishlistIds } = useCart();
  const navigate = useNavigate();

  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api
        .get(`/products/suggestions?q=${encodeURIComponent(q)}`)
        .then((res) => setSuggestions(res.data.suggestions || []))
        .catch(() => setSuggestions([]));
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    navigate(`/catalog${searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery.trim())}` : ''}`);
  };

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    toast.success('Subscribed to Active Supermarket Kabale weekly offers.');
    setNewsletterEmail('');
  };

  const isStaffOrAdmin = user && (user.role === 'admin' || user.role === 'staff');

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FB] text-[#172B4D]">
      {/* Slim Dismissible Announcement Bar */}
      {showAnnouncement && (
        <div className="bg-[#123B70] text-white text-xs py-2 px-4 no-print">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <p className="truncate font-medium">
              Same-day delivery in Kabale Town · Free pickup at Main Street Branch · Support: +256 772 480 120
            </p>
            <button
              type="button"
              onClick={() => setShowAnnouncement(false)}
              aria-label="Dismiss announcement"
              className="text-blue-200 hover:text-white shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-8">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="lg:hidden h-10 w-10 rounded-lg border border-slate-200 flex items-center justify-center text-[#172B4D]"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" aria-label="MarketSphere Home">
              <BrandLogo variant="dark" />
            </Link>
          </div>

          {/* Live Search Bar with Suggestions */}
          <div ref={searchRef} className="hidden md:block relative flex-1 max-w-md">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="h-4 w-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Search rice, coffee, fresh foods, electronics..."
                aria-label="Search supermarket products"
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-[#F5F7FB] border border-slate-200 text-sm text-[#172B4D] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#2563EB]"
              />
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
                {suggestions.map((item) => (
                  <Link
                    key={item.id}
                    to={`/product/${item.slug}`}
                    onClick={() => setShowSuggestions(false)}
                    className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#EAF3FF] transition-colors border-b border-slate-100 last:border-none"
                  >
                    <div className="h-10 w-10 rounded-md overflow-hidden bg-[#F5F7FB] shrink-0">
                      <ProductImage src={item.imageUrl} alt={item.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#172B4D] truncate">{item.name}</div>
                      <div className="text-xs text-[#64748B]">{item.categoryName}</div>
                    </div>
                    <div className="text-xs font-bold text-[#123B70] tabular-nums shrink-0">
                      {formatUgx(item.discountPriceUgx ?? item.priceUgx)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Single-line Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#172B4D]">
            <Link to="/catalog" className="hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0">
              Shop All
            </Link>
            <Link
              to="/catalog?promo=todays_deal"
              className="hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0"
            >
              Today&apos;s Deals
            </Link>
            <Link to="/track" className="hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0">
              Track Order
            </Link>
            {isStaffOrAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 text-[#123B70] font-semibold hover:text-[#2563EB] whitespace-nowrap shrink-0"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Admin BI</span>
              </Link>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/account?tab=wishlist"
              aria-label="Wishlist"
              className="relative h-10 w-10 rounded-lg border border-slate-200 flex items-center justify-center text-[#172B4D] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
            >
              <Heart className="h-4 w-4" />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {wishlistIds.length}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open shopping basket"
              className="relative inline-flex items-center gap-2 h-10 px-3 rounded-lg bg-[#EAF3FF] text-[#123B70] font-semibold text-sm hover:bg-[#2563EB] hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Basket</span>
              <span className="h-5 min-w-[20px] px-1.5 rounded-md bg-[#123B70] text-white text-xs font-bold flex items-center justify-center tabular-nums">
                {totalCount}
              </span>
            </button>

            <Link
              to={user ? '/account' : '/auth'}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB] transition-colors whitespace-nowrap shrink-0"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline max-w-[110px] truncate">
                {user ? user.fullName.split(' ')[0] : 'Sign In'}
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products in Kabale..."
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#F5F7FB] border border-slate-200 text-sm"
              />
            </form>
            <div className="grid grid-cols-2 gap-2 text-sm font-medium">
              <Link
                to="/catalog"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg bg-[#F5F7FB] text-[#172B4D]"
              >
                Shop Catalogue
              </Link>
              <Link
                to="/catalog?promo=todays_deal"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg bg-[#F5F7FB] text-[#172B4D]"
              >
                Today&apos;s Deals
              </Link>
              <Link
                to="/track"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg bg-[#F5F7FB] text-[#172B4D]"
              >
                Track Order
              </Link>
              <Link
                to={user ? '/account' : '/auth'}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg bg-[#F5F7FB] text-[#172B4D]"
              >
                {user ? 'My Account' : 'Sign In / Register'}
              </Link>
              {isStaffOrAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="col-span-2 px-3 py-2.5 rounded-lg bg-[#EAF3FF] text-[#123B70] font-semibold"
                >
                  Open Administrator BI Dashboard
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Professional Retail Footer */}
      <footer className="bg-[#0C284D] text-slate-200 mt-16 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <BrandLogo variant="light" />
            <p className="text-sm text-slate-300 leading-relaxed">
              The official online supermarket and retail management platform for{' '}
              <strong className="text-white">Active Supermarket Kabale</strong>. Fresh Kigezi produce,
              pantry staples, bakery loaves, and home essentials delivered across Kabale District.
            </p>
            <div className="space-y-1.5 text-xs text-slate-300 pt-1">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-[#38BDF8]" />
                <span>Main Street, Plot 42, Kabale Municipality</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-[#38BDF8]" />
                <span>+256 772 480 120 · Mon–Sun 7:30 AM – 9:30 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-[#38BDF8]" />
                <span>support@activesupermarketkabale.example</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider mb-3">
              Shop Categories
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <Link to="/catalog?category=groceries" className="hover:text-[#38BDF8] transition-colors">
                  Groceries & Pantry
                </Link>
              </li>
              <li>
                <Link to="/catalog?category=fresh-foods" className="hover:text-[#38BDF8] transition-colors">
                  Fresh Highland Foods
                </Link>
              </li>
              <li>
                <Link to="/catalog?category=beverages" className="hover:text-[#38BDF8] transition-colors">
                  Coffee, Tea & Beverages
                </Link>
              </li>
              <li>
                <Link to="/catalog?category=bakery" className="hover:text-[#38BDF8] transition-colors">
                  In-Store Bakery
                </Link>
              </li>
              <li>
                <Link to="/catalog?category=electronics-accessories" className="hover:text-[#38BDF8] transition-colors">
                  Home Electronics
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider mb-3">
              Customer Service
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <Link to="/track" className="hover:text-[#38BDF8] transition-colors">
                  Track Your Order
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-[#38BDF8] transition-colors">
                  Shopping Basket
                </Link>
              </li>
              <li>
                <Link to="/account" className="hover:text-[#38BDF8] transition-colors">
                  Account & Receipts
                </Link>
              </li>
              <li>
                <Link to="/auth" className="hover:text-[#38BDF8] transition-colors">
                  Sign In / Register
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-[#38BDF8] transition-colors">
                  Staff & Admin Portal
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider mb-3">
              Weekly Supermarket Circular
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Receive notifications on Kabale weekend specials, fresh harvest arrivals, and household bundle deals.
            </p>
            <form onSubmit={handleNewsletter} className="flex gap-2">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email for newsletter"
                className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-[#123B70] border border-blue-800 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#38BDF8]"
              />
              <button
                type="submit"
                className="px-4 h-10 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#38BDF8] hover:text-[#0C284D] transition-colors shrink-0"
              >
                Subscribe
              </button>
            </form>
            <p className="text-[11px] text-slate-400 mt-3">
              Delivery zones: Kabale Central, Makanga, Kikungiri, Nyabikoni, Kisoro & Rubanda.
            </p>
          </div>
        </div>

        <div className="border-t border-blue-900/70 py-4 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              © {new Date().getFullYear()} MarketSphere · Active Supermarket Kabale. All rights reserved.
            </span>
            <span>Academic Prototype — MGT3151 E-Business, E-Commerce & E-Governance</span>
          </div>
        </div>
      </footer>

      <CartDrawer />
    </div>
  );
}
