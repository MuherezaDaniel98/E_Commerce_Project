import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.tsx';
import { formatUgx } from '../utils/format.ts';
import { ProductImage } from './ProductImage.tsx';

export function CartDrawer() {
  const { items, subtotalUgx, isDrawerOpen, setDrawerOpen, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  const freeThreshold = 150000;
  const remainingForFree = Math.max(0, freeThreshold - subtotalUgx);
  const progressPct = Math.min(100, Math.round((subtotalUgx / freeThreshold) * 100));

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" role="dialog" aria-modal="true" aria-label="Shopping Basket">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#172B4D]">Your Shopping Basket</h2>
            <p className="text-xs text-[#64748B]">Active Supermarket Kabale</p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close basket"
            className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-[#64748B] hover:text-[#172B4D]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Free delivery meter */}
        <div className="px-5 py-3 bg-[#EAF3FF] border-b border-blue-100">
          <div className="flex items-center justify-between text-xs font-medium text-[#123B70]">
            <span>
              {remainingForFree === 0
                ? 'You qualify for free Kabale Town delivery'
                : `Add ${formatUgx(remainingForFree)} more for free Kabale delivery`}
            </span>
            <span className="tabular-nums">{progressPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563EB] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="h-12 w-12 text-slate-300 mb-3" />
              <p className="font-display font-semibold text-[#172B4D]">Your basket is empty</p>
              <p className="text-sm text-[#64748B] mt-1 max-w-xs">
                Browse fresh groceries, bakery loaves, and household essentials from Active Supermarket Kabale.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  navigate('/catalog');
                }}
                className="mt-5 px-5 py-2.5 rounded-lg bg-[#123B70] text-white text-sm font-semibold hover:bg-[#2563EB] transition-colors"
              >
                Explore Products
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.productId}
                className="flex gap-3.5 pb-4 border-b border-slate-100 last:border-none"
              >
                <div className="h-20 w-20 rounded-lg overflow-hidden bg-[#F5F7FB] shrink-0 border border-slate-200">
                  <ProductImage src={item.imageUrl} alt={item.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/product/${item.slug}`}
                    onClick={() => setDrawerOpen(false)}
                    className="font-medium text-sm text-[#172B4D] hover:text-[#2563EB] line-clamp-2"
                  >
                    {item.name}
                  </Link>
                  <div className="text-xs text-[#64748B] mt-0.5 tabular-nums">
                    {formatUgx(item.unitPriceUgx)} each
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="inline-flex items-center border border-slate-200 rounded-md">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="h-8 w-8 flex items-center justify-center hover:bg-slate-50"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="h-8 w-8 flex items-center justify-center hover:bg-slate-50"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#123B70] tabular-nums">
                        {formatUgx(item.unitPriceUgx * item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        aria-label={`Remove ${item.name}`}
                        className="text-slate-400 hover:text-[#DC2626] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#64748B]">Subtotal</span>
              <span className="font-display text-lg font-bold text-[#123B70] tabular-nums">
                {formatUgx(subtotalUgx)}
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Delivery fees calculated at checkout based on your Kabale delivery or collection point.
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  navigate('/cart');
                }}
                className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-[#172B4D] hover:bg-slate-50 transition-colors"
              >
                View Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  navigate('/checkout');
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70] transition-colors"
              >
                <span>Checkout</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
