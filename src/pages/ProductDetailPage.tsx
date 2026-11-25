import {
  ArrowLeft,
  Bell,
  BellRing,
  CheckCircle2,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductCard } from '../components/ProductCard.tsx';
import { ProductImage } from '../components/ProductImage.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { StorefrontLayout } from '../layouts/StorefrontLayout.tsx';
import { api } from '../services/api.ts';
import { ProductDTO, formatShortDate, formatUgx } from '../utils/format.ts';

interface ReviewItem {
  id: number;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface PriceAlertRecord {
  id: number;
  productId: number;
  email: string;
  targetPriceUgx: number | null;
  baselinePriceUgx: number;
  status: 'active' | 'triggered' | 'paused';
  lastTriggeredPriceUgx: number | null;
}

export function ProductDetailPage() {
  const { idOrSlug } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { addToCart, wishlistIds, toggleWishlist, refreshPriceAlerts } = useCart();

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [related, setRelated] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [alertOpen, setAlertOpen] = useState(location.hash === '#price-alert');
  const [existingAlert, setExistingAlert] = useState<PriceAlertRecord | null>(null);
  const [watcherCount, setWatcherCount] = useState(0);
  const [alertMode, setAlertMode] = useState<'any' | 'target'>('any');
  const [targetPriceInput, setTargetPriceInput] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setAlertEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (location.hash === '#price-alert') {
      setAlertOpen(true);
    }
  }, [location.hash]);

  const loadProductAlertStatus = useCallback(async (productId: number) => {
    try {
      const res = await api.get(`/price-alerts/product/${productId}`);
      setWatcherCount(Number(res.data.watcherCount || 0));
      const found = res.data.alert as PriceAlertRecord | null;
      setExistingAlert(found);
      if (found) {
        if (found.targetPriceUgx) {
          setAlertMode('target');
          setTargetPriceInput(String(found.targetPriceUgx));
        } else {
          setAlertMode('any');
          setTargetPriceInput('');
        }
      }
    } catch {
      // Ignore alert fetch errors
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setQty(1);
    setExistingAlert(null);
    api
      .get(`/products/${idOrSlug}`)
      .then((res) => {
        setProduct(res.data.product);
        setReviews(res.data.reviews || []);
        setRelated(res.data.related || []);
        if (res.data.product?.id) {
          loadProductAlertStatus(res.data.product.id);
        }
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [idOrSlug, loadProductAlertStatus]);

  useEffect(() => {
    if (product?.id) {
      loadProductAlertStatus(product.id);
    }
  }, [user, product?.id, loadProductAlertStatus]);

  const handleSavePriceAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    const effective = product.discountPriceUgx ?? product.priceUgx;
    const parsedTarget =
      alertMode === 'target' ? Math.round(Number(targetPriceInput || 0)) : null;

    if (alertMode === 'target' && (!parsedTarget || parsedTarget <= 0 || parsedTarget >= effective)) {
      toast.error(`Enter a target price lower than ${formatUgx(effective)}.`);
      return;
    }

    setSavingAlert(true);
    try {
      const res = await api.post('/price-alerts', {
        productId: product.id,
        targetPriceUgx: parsedTarget,
        email: user ? undefined : alertEmail.trim(),
      });
      setExistingAlert(res.data.alert);
      await loadProductAlertStatus(product.id);
      await refreshPriceAlerts();
      window.dispatchEvent(new Event('marketsphere:alerts-changed'));
      toast.success(
        res.data.updated
          ? 'Price alert updated.'
          : 'Price alert activated! We will notify you when the price drops.'
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save price alert.');
    } finally {
      setSavingAlert(false);
    }
  };

  const handleRemovePriceAlert = async () => {
    if (!existingAlert || !product) return;
    setSavingAlert(true);
    try {
      await api.delete(`/price-alerts/${existingAlert.id}`);
      setExistingAlert(null);
      setAlertMode('any');
      setTargetPriceInput('');
      await loadProductAlertStatus(product.id);
      await refreshPriceAlerts();
      window.dispatchEvent(new Event('marketsphere:alerts-changed'));
      toast.success('Price alert removed.');
    } catch {
      toast.error('Could not remove price alert.');
    } finally {
      setSavingAlert(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSubmittingReview(true);
    try {
      const res = await api.post(`/products/${product.id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment,
      });
      setReviews((prev) => [res.data.review, ...prev]);
      setReviewComment('');
      toast.success('Thank you! Your review has been posted.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <StorefrontLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="h-96 rounded-xl bg-white border border-slate-200 animate-pulse" />
        </div>
      </StorefrontLayout>
    );
  }

  if (!product) {
    return (
      <StorefrontLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Product Not Found</h1>
          <Link to="/catalog" className="mt-4 inline-block text-sm font-semibold text-[#2563EB]">
            Return to Catalogue
          </Link>
        </div>
      </StorefrontLayout>
    );
  }

  const effectivePrice = product.discountPriceUgx ?? product.priceUgx;
  const hasDiscount = product.discountPriceUgx !== null && product.discountPriceUgx < product.priceUgx;
  const isWishlisted = wishlistIds.includes(product.id);
  const isOutOfStock = product.quantityOnHand <= 0;
  const specs = Object.entries(product.specifications || {});

  return (
    <StorefrontLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#123B70] mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Catalogue</span>
        </Link>

        {/* Contiguous Purchase Module */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#F5F7FB] border border-slate-100 sticky top-24">
              <ProductImage src={product.imageUrl} alt={product.name} />
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                <Link
                  to={`/catalog?category=${product.categorySlug}`}
                  className="font-semibold text-[#2563EB] uppercase tracking-wider hover:underline"
                >
                  {product.categoryName}
                </Link>
                <span>·</span>
                <span className="font-mono">SKU: {product.sku}</span>
                <span>·</span>
                <span className={isOutOfStock ? 'text-[#DC2626] font-semibold' : 'text-[#16A34A] font-semibold'}>
                  {isOutOfStock ? 'Out of Stock' : `${product.quantityOnHand} units in stock`}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] mt-2">
                {product.name}
              </h1>

              <div className="flex items-center gap-2 mt-3 text-sm text-[#64748B]">
                <Star className="h-4 w-4 text-[#F59E0B] fill-[#F59E0B]" />
                <span className="font-semibold text-[#172B4D] tabular-nums">
                  {product.ratingAvg.toFixed(1)}
                </span>
                <span>({reviews.length} customer reviews)</span>
              </div>

              <div className="mt-5 pb-5 border-b border-slate-100 flex items-baseline gap-3">
                <span className="font-display text-3xl font-extrabold text-[#123B70] tabular-nums">
                  {formatUgx(effectivePrice)}
                </span>
                {hasDiscount && (
                  <span className="text-base text-[#64748B] line-through tabular-nums">
                    {formatUgx(product.priceUgx)}
                  </span>
                )}
              </div>

              <p className="mt-5 text-sm sm:text-base text-[#64748B] leading-relaxed">
                {product.description}
              </p>

              {specs.length > 0 && (
                <div className="mt-6">
                  <h2 className="font-display text-sm font-bold text-[#172B4D] mb-2.5">
                    Product Specifications
                  </h2>
                  <dl className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-sm">
                    {specs.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-3 px-3.5 py-2.5">
                        <dt className="text-[#64748B] font-medium">{k}</dt>
                        <dd className="col-span-2 text-[#172B4D] font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="h-11 w-11 flex items-center justify-center hover:bg-slate-50"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-bold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(Math.max(1, product.quantityOnHand), q + 1))}
                    aria-label="Increase quantity"
                    className="h-11 w-11 flex items-center justify-center hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => addToCart(product, qty)}
                  className="flex-1 min-w-[180px] h-11 inline-flex items-center justify-center gap-2 px-6 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70] disabled:bg-slate-200 disabled:text-slate-500 transition-colors"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{isOutOfStock ? 'Currently Out of Stock' : 'Add to Shopping Basket'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAlertOpen((v) => !v)}
                  aria-label="Set price drop alert"
                  className={`h-11 px-4 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                    existingAlert?.status === 'active'
                      ? 'bg-[#123B70] border-[#123B70] text-white'
                      : 'border-slate-200 text-[#172B4D] hover:border-[#2563EB] hover:text-[#2563EB]'
                  }`}
                >
                  {existingAlert?.status === 'active' ? (
                    <BellRing className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {existingAlert?.status === 'active' ? 'Alert Active' : 'Price Alert'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label="Add to wishlist"
                  className={`h-11 px-4 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                    isWishlisted
                      ? 'bg-[#EAF3FF] border-[#2563EB] text-[#2563EB]'
                      : 'border-slate-200 text-[#172B4D] hover:border-[#2563EB]'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
                </button>
              </div>

              {(alertOpen || existingAlert) && (
                <div
                  id="price-alert"
                  className="bg-[#EAF3FF]/70 border border-blue-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-[#2563EB]" />
                      <h3 className="font-display text-sm font-bold text-[#123B70]">
                        Price Drop Alert
                      </h3>
                    </div>
                    {watcherCount > 0 && (
                      <span className="text-xs font-medium text-[#64748B] tabular-nums">
                        {watcherCount} shopper{watcherCount === 1 ? '' : 's'} watching
                      </span>
                    )}
                  </div>

                  {existingAlert?.status === 'triggered' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-[#16A34A] flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        Price dropped to {formatUgx(existingAlert.lastTriggeredPriceUgx ?? effectivePrice)}!
                        Re-activate below to watch for an even lower price.
                      </span>
                    </div>
                  )}

                  {existingAlert?.status === 'active' && (
                    <p className="text-xs text-[#123B70] font-medium">
                      Active alert:{' '}
                      {existingAlert.targetPriceUgx
                        ? `Notify when price reaches ${formatUgx(existingAlert.targetPriceUgx)} or less`
                        : `Notify on any drop below ${formatUgx(existingAlert.baselinePriceUgx)}`}
                    </p>
                  )}

                  <form onSubmit={handleSavePriceAlert} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setAlertMode('any')}
                        className={`py-2 px-3 rounded-lg border font-semibold text-left transition-colors ${
                          alertMode === 'any'
                            ? 'bg-white border-[#2563EB] text-[#123B70]'
                            : 'bg-white/60 border-slate-200 text-[#64748B]'
                        }`}
                      >
                        Any price drop
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAlertMode('target');
                          if (!targetPriceInput) {
                            setTargetPriceInput(String(Math.round(effectivePrice * 0.9)));
                          }
                        }}
                        className={`py-2 px-3 rounded-lg border font-semibold text-left transition-colors ${
                          alertMode === 'target'
                            ? 'bg-white border-[#2563EB] text-[#123B70]'
                            : 'bg-white/60 border-slate-200 text-[#64748B]'
                        }`}
                      >
                        Set target price (UGX)
                      </button>
                    </div>

                    {alertMode === 'target' && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={100}
                            max={effectivePrice - 1}
                            required
                            value={targetPriceInput}
                            onChange={(e) => setTargetPriceInput(e.target.value)}
                            placeholder={`Under ${effectivePrice}`}
                            className="flex-1 min-w-[140px] h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm tabular-nums"
                          />
                          {[10, 15, 25].map((pct) => {
                            const suggested = Math.round((effectivePrice * (100 - pct)) / 100);
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => setTargetPriceInput(String(suggested))}
                                className="h-9 px-2.5 rounded-lg border border-blue-200 bg-white text-xs font-semibold text-[#123B70] hover:border-[#2563EB]"
                              >
                                -{pct}%
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {!user && (
                      <input
                        type="email"
                        required
                        value={alertEmail}
                        onChange={(e) => setAlertEmail(e.target.value)}
                        placeholder="Enter your email"
                        aria-label="Email for price drop notification"
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                      />
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="submit"
                        disabled={savingAlert}
                        className="h-9 px-4 rounded-lg bg-[#123B70] text-white text-xs font-semibold hover:bg-[#2563EB] disabled:opacity-60"
                      >
                        {savingAlert
                          ? 'Saving...'
                          : existingAlert?.status === 'active'
                          ? 'Update Price Alert'
                          : 'Activate Price Alert'}
                      </button>
                      {existingAlert && user && (
                        <button
                          type="button"
                          onClick={handleRemovePriceAlert}
                          disabled={savingAlert}
                          className="h-9 px-3 rounded-lg border border-rose-200 bg-white text-xs font-semibold text-[#DC2626] inline-flex items-center gap-1 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#64748B] bg-[#F5F7FB] rounded-lg p-3.5">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-[#2563EB] shrink-0" />
                  <span>Same-day Kabale delivery or free Main Street pickup</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#16A34A] shrink-0" />
                  <span>Quality verified by Active Supermarket Kabale</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews */}
        <section className="mt-10 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-[#172B4D] mb-6">
            Customer Reviews ({reviews.length})
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-4">
              {reviews.length === 0 ? (
                <p className="text-sm text-[#64748B]">
                  No reviews yet. Be the first shopper to review this product.
                </p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="pb-4 border-b border-slate-100 last:border-none">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[#172B4D]">{r.authorName}</span>
                      <span className="text-xs text-[#64748B]">{formatShortDate(r.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#F59E0B] my-1">
                      {Array.from({ length: r.rating }).map((_, idx) => (
                        <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                      ))}
                    </div>
                    <p className="text-sm text-[#64748B]">{r.comment}</p>
                  </div>
                ))
              )}
            </div>

            <div className="lg:col-span-5 bg-[#F5F7FB] rounded-xl p-5 border border-slate-200">
              <h3 className="font-display text-sm font-bold text-[#172B4D] mb-3">Write a Review</h3>
              {user ? (
                <form onSubmit={handleReviewSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-1">Rating</label>
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                    >
                      <option value={5}>5 Stars — Excellent</option>
                      <option value={4}>4 Stars — Very Good</option>
                      <option value={3}>3 Stars — Average</option>
                      <option value={2}>2 Stars — Below Average</option>
                      <option value={1}>1 Star — Poor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-1">Your Review</label>
                    <textarea
                      required
                      minLength={5}
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share product quality or delivery experience..."
                      className="w-full p-3 rounded-lg border border-slate-200 bg-white text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full h-10 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB] disabled:opacity-60"
                  >
                    {submittingReview ? 'Submitting...' : 'Post Review'}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-[#64748B]">
                  Please{' '}
                  <Link to="/auth" className="text-[#2563EB] font-semibold hover:underline">
                    sign in
                  </Link>{' '}
                  to post a verified customer review.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Related Products */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold text-[#172B4D] mb-5">
              Related Products in {product.categoryName}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </StorefrontLayout>
  );
}
