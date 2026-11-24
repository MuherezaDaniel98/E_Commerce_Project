import { Eye, Heart, ShoppingCart, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.tsx';
import { ProductDTO, formatUgx } from '../utils/format.ts';
import { ProductImage } from './ProductImage.tsx';

interface ProductCardProps {
  product: ProductDTO;
  onQuickView?: (product: ProductDTO) => void;
}

export function ProductCard({ product, onQuickView }: ProductCardProps) {
  const { addToCart, wishlistIds, toggleWishlist } = useCart();
  const isWishlisted = wishlistIds.includes(product.id);
  const effectivePrice = product.discountPriceUgx ?? product.priceUgx;
  const hasDiscount = product.discountPriceUgx !== null && product.discountPriceUgx < product.priceUgx;
  const discountPct = hasDiscount
    ? Math.round(((product.priceUgx - (product.discountPriceUgx || 0)) / product.priceUgx) * 100)
    : 0;

  const isOutOfStock = product.quantityOnHand <= 0;
  const isLowStock = !isOutOfStock && product.quantityOnHand <= product.lowStockThreshold;

  return (
    <article className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-[#F5F7FB] overflow-hidden">
        <Link to={`/product/${product.slug}`} className="block w-full h-full">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>

        {/* Action icon buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {onQuickView && (
            <button
              type="button"
              onClick={() => onQuickView(product)}
              aria-label={`Quick view ${product.name}`}
              className="h-9 w-9 rounded-lg bg-white/95 text-[#172B4D] border border-slate-200/80 flex items-center justify-center hover:bg-[#123B70] hover:text-white transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            aria-label={`Toggle wishlist for ${product.name}`}
            className={`h-9 w-9 rounded-lg border flex items-center justify-center transition-colors ${
              isWishlisted
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : 'bg-white/95 text-[#172B4D] border-slate-200/80 hover:text-[#2563EB]'
            }`}
          >
            <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        </div>

        {hasDiscount && (
          <span className="absolute bottom-3 left-3 bg-[#123B70] text-white text-xs font-semibold px-2.5 py-1 rounded-md tabular-nums">
            Save {discountPct}%
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-1.5">
          {/* Clean unboxed metadata with typographic separators */}
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] truncate">
            <span className="font-medium text-[#2563EB] uppercase tracking-wide">{product.categoryName}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                isOutOfStock
                  ? 'text-[#DC2626] font-medium'
                  : isLowStock
                  ? 'text-[#D97706] font-medium'
                  : 'text-[#16A34A] font-medium'
              }
            >
              {isOutOfStock
                ? 'Out of Stock'
                : isLowStock
                ? `Only ${product.quantityOnHand} left`
                : 'In Stock'}
            </span>
          </div>

          <Link
            to={`/product/${product.slug}`}
            className="block font-display text-[15px] font-semibold text-[#172B4D] leading-snug line-clamp-2 hover:text-[#2563EB] transition-colors min-h-[2.6rem]"
          >
            {product.name}
          </Link>

          <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
            <Star className="h-3.5 w-3.5 text-[#F59E0B] fill-[#F59E0B]" />
            <span className="font-medium text-[#172B4D] tabular-nums">{product.ratingAvg.toFixed(1)}</span>
            <span>({product.reviewCount})</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="font-display text-base font-bold text-[#123B70] tabular-nums">
              {formatUgx(effectivePrice)}
            </div>
            {hasDiscount && (
              <div className="text-xs text-[#64748B] line-through tabular-nums">
                {formatUgx(product.priceUgx)}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={() => addToCart(product, 1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#123B70] disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>{isOutOfStock ? 'Unavailable' : 'Add'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
