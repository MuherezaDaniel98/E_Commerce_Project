import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard.tsx';
import { QuickViewModal } from '../components/QuickViewModal.tsx';
import { StorefrontLayout } from '../layouts/StorefrontLayout.tsx';
import { api } from '../services/api.ts';
import { ProductDTO } from '../utils/format.ts';

interface CategoryItem {
  id: number;
  name: string;
  slug: string;
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState<ProductDTO | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || 'all';
  const promo = searchParams.get('promo') || 'all';
  const availability = searchParams.get('availability') || 'all';
  const sort = searchParams.get('sort') || 'featured';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const page = Number(searchParams.get('page') || 1);

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    api
      .get('/categories')
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category && category !== 'all') params.set('category', category);
    if (promo && promo !== 'all') params.set('promo', promo);
    if (availability && availability !== 'all') params.set('availability', availability);
    if (sort) params.set('sort', sort);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    params.set('page', String(page));
    params.set('limit', '12');

    api
      .get(`/products?${params.toString()}`)
      .then((res) => {
        setProducts(res.data.items || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [search, category, promo, availability, sort, minPrice, maxPrice, page]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    if (key !== 'page') {
      next.set('page', '1');
    }
    setSearchParams(next);
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-sm font-bold text-[#172B4D] mb-2.5">Search</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateParam('search', searchInput.trim());
          }}
          className="flex gap-2"
        >
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Keyword or SKU..."
            className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#2563EB]"
          />
          <button
            type="submit"
            aria-label="Apply search"
            className="h-9 w-9 rounded-lg bg-[#123B70] text-white flex items-center justify-center shrink-0"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div>
        <h3 className="font-display text-sm font-bold text-[#172B4D] mb-2.5">Category</h3>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => updateParam('category', 'all')}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
              category === 'all'
                ? 'bg-[#EAF3FF] text-[#123B70] font-semibold'
                : 'text-[#64748B] hover:text-[#172B4D]'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => updateParam('category', cat.slug)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                category === cat.slug
                  ? 'bg-[#EAF3FF] text-[#123B70] font-semibold'
                  : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-bold text-[#172B4D] mb-2.5">Price Range (UGX)</h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={(e) => updateParam('minPrice', e.target.value)}
            placeholder="Min UGX"
            className="h-9 px-2.5 rounded-lg border border-slate-200 text-xs tabular-nums"
          />
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(e) => updateParam('maxPrice', e.target.value)}
            placeholder="Max UGX"
            className="h-9 px-2.5 rounded-lg border border-slate-200 text-xs tabular-nums"
          />
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-bold text-[#172B4D] mb-2.5">Availability</h3>
        <select
          value={availability}
          onChange={(e) => updateParam('availability', e.target.value)}
          className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="all">All Items</option>
          <option value="in_stock">In Stock Only</option>
          <option value="low_stock">Limited / Low Stock</option>
        </select>
      </div>

      <div>
        <h3 className="font-display text-sm font-bold text-[#172B4D] mb-2.5">Promotions</h3>
        <select
          value={promo}
          onChange={(e) => updateParam('promo', e.target.value)}
          className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="all">All Promotions</option>
          <option value="todays_deal">Today&apos;s Deals</option>
          <option value="weekly_offer">Weekly Offers</option>
          <option value="best_seller">Best Sellers</option>
          <option value="new_arrival">New Arrivals</option>
        </select>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="w-full py-2 rounded-lg border border-slate-200 text-xs font-semibold text-[#64748B] hover:text-[#172B4D] hover:bg-slate-50"
      >
        Reset All Filters
      </button>
    </div>
  );

  return (
    <StorefrontLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D]">
              Supermarket Catalogue
            </h1>
            <p className="text-sm text-[#64748B] mt-1 tabular-nums">
              Showing {products.length} of {total} products available at Active Supermarket Kabale
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="lg:hidden inline-flex items-center gap-2 px-3.5 h-10 rounded-lg border border-slate-200 bg-white text-sm font-medium"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </button>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#64748B] hidden sm:block" />
              <select
                value={sort}
                onChange={(e) => updateParam('sort', e.target.value)}
                aria-label="Sort products"
                className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-[#172B4D]"
              >
                <option value="featured">Featured</option>
                <option value="popular">Most Popular</option>
                <option value="newest">Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        {mobileFiltersOpen && (
          <div className="lg:hidden mb-6 bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-bold text-sm">Filter Products</span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="text-[#64748B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {filterPanel}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="hidden lg:block lg:col-span-3">
            <div className="bg-white border border-slate-200 rounded-xl p-5 sticky top-24">
              {filterPanel}
            </div>
          </aside>

          <div className="lg:col-span-9">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="h-80 rounded-xl bg-white border border-slate-200 animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <p className="font-display text-lg font-bold text-[#172B4D]">
                  No products matched your filters
                </p>
                <p className="text-sm text-[#64748B] mt-1">
                  Try clearing a price filter or browsing all supermarket categories.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 px-5 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
                >
                  Show All Products
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onQuickView={setQuickViewProduct}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const p = idx + 1;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateParam('page', String(p))}
                          className={`h-9 min-w-[36px] px-3 rounded-lg text-sm font-semibold tabular-nums transition-colors ${
                            p === page
                              ? 'bg-[#123B70] text-white'
                              : 'bg-white border border-slate-200 text-[#172B4D] hover:bg-slate-50'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </StorefrontLayout>
  );
}
