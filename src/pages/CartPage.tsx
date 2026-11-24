import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductImage } from '../components/ProductImage.tsx';
import { useCart } from '../context/CartContext.tsx';
import { StorefrontLayout } from '../layouts/StorefrontLayout.tsx';
import { api } from '../services/api.ts';
import { formatUgx } from '../utils/format.ts';

export function CartPage() {
  const { items, subtotalUgx, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  const [validating, setValidating] = useState(false);

  const handleCheckout = async () => {
    setValidating(true);
    try {
      const res = await api.post('/cart/validate', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      if (!res.data.valid) {
        toast.error(res.data.issues?.[0] || 'Please check stock availability before checkout.');
        return;
      }
      navigate('/checkout');
    } catch {
      toast.error('Unable to validate cart stock right now.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <StorefrontLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] mb-6">
          Shopping Basket
        </h1>

        {items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <ShoppingBag className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold text-[#172B4D]">Your basket is empty</h2>
            <p className="text-sm text-[#64748B] mt-1">
              Explore groceries, fresh foods, bakery items, and electronics at Active Supermarket Kabale.
            </p>
            <Link
              to="/catalog"
              className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB]"
            >
              <span>Browse Catalogue</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.productId} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="h-20 w-24 rounded-lg overflow-hidden bg-[#F5F7FB] border border-slate-100 shrink-0">
                    <ProductImage src={item.imageUrl} alt={item.name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#64748B]">
                      {item.categoryName} · {item.sku}
                    </div>
                    <Link
                      to={`/product/${item.slug}`}
                      className="font-display font-semibold text-base text-[#172B4D] hover:text-[#2563EB]"
                    >
                      {item.name}
                    </Link>
                    <div className="text-sm font-semibold text-[#123B70] mt-1 tabular-nums">
                      {formatUgx(item.unitPriceUgx)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-5">
                    <div className="inline-flex items-center border border-slate-200 rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="h-9 w-9 flex items-center justify-center hover:bg-slate-50"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="h-9 w-9 flex items-center justify-center hover:bg-slate-50"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <div className="font-display font-bold text-[#123B70] tabular-nums">
                        {formatUgx(item.unitPriceUgx * item.quantity)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      aria-label={`Remove ${item.name}`}
                      className="text-slate-400 hover:text-[#DC2626]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <aside className="lg:col-span-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 sticky top-24">
                <h2 className="font-display text-lg font-bold text-[#172B4D]">Order Summary</h2>
                <div className="space-y-2 text-sm border-b border-slate-100 pb-4">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Items Subtotal</span>
                    <span className="font-semibold text-[#172B4D] tabular-nums">
                      {formatUgx(subtotalUgx)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Estimated Delivery</span>
                    <span className="text-[#64748B]">
                      {subtotalUgx >= 150000 ? 'Free (Kabale Town)' : 'Calculated next'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-[#172B4D]">Estimated Total</span>
                  <span className="font-display text-xl font-extrabold text-[#123B70] tabular-nums">
                    {formatUgx(subtotalUgx)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={validating}
                  onClick={handleCheckout}
                  className="w-full h-11 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span>{validating ? 'Validating Stock...' : 'Proceed to Checkout'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
