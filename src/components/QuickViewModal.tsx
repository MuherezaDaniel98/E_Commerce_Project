import { Heart, Minus, Plus, ShoppingCart, Star, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.tsx';
import { ProductDTO, formatUgx } from '../utils/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface QuickViewModalProps {
  product: ProductDTO | null;
  onClose: () => void;
}

export function QuickViewModal({ product, onClose }: QuickViewModalProps) {
  const { addToCart, wishlistIds, toggleWishlist } = useCart();
  const [qty, setQty] = useState(1);

  if (!product) return null;

  const effectivePrice = product.discountPriceUgx ?? product.priceUgx;
  const hasDiscount = product.discountPriceUgx !== null && product.discountPriceUgx < product.priceUgx;
  const isWishlisted = wishlistIds.includes(product.id);
  const isOutOfStock = product.quantityOnHand <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full overflow-hidden shadow-xl grid grid-cols-1 md:grid-cols-2">
        <div className="relative aspect-[4/3] md:aspect-auto bg-[#F5F7FB]">
          <ProductImage src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        </div>

        <div className="p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-[#64748B] flex items-center gap-2">
                <span className="font-semibold text-[#2563EB] uppercase">{product.categoryName}</span>
                <span>·</span>
                <span className="font-mono">{product.sku}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close quick view"
                className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-[#64748B] hover:text-[#172B4D]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h2 className="font-display text-xl font-bold text-[#172B4D] mt-2">{product.name}</h2>

            <div className="flex items-center gap-2 mt-2 text-sm text-[#64748B]">
              <Star className="h-4 w-4 text-[#F59E0B] fill-[#F59E0B]" />
              <span className="font-semibold text-[#172B4D] tabular-nums">{product.ratingAvg.toFixed(1)}</span>
              <span>({product.reviewCount} reviews)</span>
              <span>·</span>
              <span className={isOutOfStock ? 'text-[#DC2626] font-medium' : 'text-[#16A34A] font-medium'}>
                {isOutOfStock ? 'Out of stock' : `${product.quantityOnHand} units available`}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-2xl font-bold text-[#123B70] tabular-nums">
                {formatUgx(effectivePrice)}
              </span>
              {hasDiscount && (
                <span className="text-sm text-[#64748B] line-through tabular-nums">
                  {formatUgx(product.priceUgx)}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm text-[#64748B] leading-relaxed">{product.description}</p>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="h-10 w-10 flex items-center justify-center text-[#172B4D] hover:bg-slate-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(Math.max(1, product.quantityOnHand), q + 1))}
                  className="h-10 w-10 flex items-center justify-center text-[#172B4D] hover:bg-slate-50"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={isOutOfStock}
                onClick={() => {
                  addToCart(product, qty);
                  onClose();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#123B70] disabled:bg-slate-200 disabled:text-slate-500 transition-colors min-h-[42px]"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>{isOutOfStock ? 'Out of Stock' : 'Add to Basket'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label="Save to wishlist"
                className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-colors ${
                  isWishlisted
                    ? 'bg-[#EAF3FF] border-[#2563EB] text-[#2563EB]'
                    : 'border-slate-200 text-[#64748B] hover:text-[#2563EB]'
                }`}
              >
                <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            <Link
              to={`/product/${product.slug}`}
              onClick={onClose}
              className="block text-center text-sm font-semibold text-[#2563EB] hover:underline py-1"
            >
              View Full Product Specifications & Reviews
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
