import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../services/api.ts';
import { ProductDTO } from '../utils/format.ts';
import { useAuth } from './AuthContext.tsx';

export interface CartItem {
  productId: number;
  name: string;
  slug: string;
  sku: string;
  imageUrl: string;
  unitPriceUgx: number;
  regularPriceUgx: number;
  quantity: number;
  maxStock: number;
  categoryName: string;
}

interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  subtotalUgx: number;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  addToCart: (product: ProductDTO, quantity?: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
  wishlistIds: number[];
  toggleWishlist: (productId: number) => Promise<void>;
  priceAlertProductIds: number[];
  togglePriceAlert: (productId: number) => Promise<boolean>;
  refreshPriceAlerts: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_STORAGE_KEY = 'marketsphere_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [priceAlertProductIds, setPriceAlertProductIds] = useState<number[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage quota errors
    }
  }, [items]);

  const refreshPriceAlerts = useCallback(async () => {
    if (!user) {
      setPriceAlertProductIds([]);
      return;
    }
    try {
      const res = await api.get('/price-alerts');
      const activeIds = (res.data.alerts || [])
        .filter((a: { status: string }) => a.status === 'active')
        .map((a: { productId: number }) => a.productId);
      setPriceAlertProductIds(activeIds);
    } catch {
      // Ignore fetch errors when offline/unauthenticated
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setWishlistIds([]);
      setPriceAlertProductIds([]);
      return;
    }
    api
      .get('/wishlist')
      .then((res) => {
        setWishlistIds((res.data.items || []).map((w: { productId: number }) => w.productId));
      })
      .catch(() => {});
    refreshPriceAlerts();
  }, [user, refreshPriceAlerts]);

  const addToCart = useCallback((product: ProductDTO, quantity = 1) => {
    if (product.quantityOnHand <= 0) {
      toast.error(`${product.name} is currently out of stock.`);
      return;
    }

    const effectivePrice = product.discountPriceUgx ?? product.priceUgx;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        const nextQty = Math.min(product.quantityOnHand, existing.quantity + quantity);
        if (nextQty === existing.quantity) {
          toast.warning(`Maximum available stock (${product.quantityOnHand}) already in cart.`);
          return prev;
        }
        toast.success(`Updated ${product.name} quantity in basket.`);
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: nextQty, maxStock: product.quantityOnHand } : i
        );
      }

      toast.success(`Added ${product.name} to basket.`);
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          imageUrl: product.imageUrl,
          unitPriceUgx: effectivePrice,
          regularPriceUgx: product.priceUgx,
          quantity: Math.min(product.quantityOnHand, quantity),
          maxStock: product.quantityOnHand,
          categoryName: product.categoryName,
        },
      ];
    });
    setDrawerOpen(true);
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.min(i.maxStock, quantity) } : i
      )
    );
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const toggleWishlist = useCallback(
    async (productId: number) => {
      if (!user) {
        toast.info('Please sign in to save items to your wishlist.');
        return;
      }
      try {
        const res = await api.post('/wishlist/toggle', { productId });
        const added = Boolean(res.data.wishlisted);
        setWishlistIds((prev) =>
          added ? [...new Set([...prev, productId])] : prev.filter((id) => id !== productId)
        );
        toast.success(added ? 'Saved to your wishlist.' : 'Removed from wishlist.');
      } catch {
        toast.error('Unable to update wishlist.');
      }
    },
    [user]
  );

  const togglePriceAlert = useCallback(
    async (productId: number): Promise<boolean> => {
      if (!user) {
        return false;
      }
      try {
        const res = await api.post('/price-alerts/toggle', { productId });
        const watching = Boolean(res.data.watching);
        setPriceAlertProductIds((prev) =>
          watching ? [...new Set([...prev, productId])] : prev.filter((id) => id !== productId)
        );
        toast.success(
          watching
            ? 'Price alert enabled! You will be notified when the price drops.'
            : 'Price alert removed.'
        );
        window.dispatchEvent(new Event('marketsphere:alerts-changed'));
        return true;
      } catch {
        toast.error('Unable to update price alert.');
        return false;
      }
    },
    [user]
  );

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalUgx = items.reduce((sum, i) => sum + i.unitPriceUgx * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        totalCount,
        subtotalUgx,
        isDrawerOpen,
        setDrawerOpen,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        wishlistIds,
        toggleWishlist,
        priceAlertProductIds,
        togglePriceAlert,
        refreshPriceAlerts,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return ctx;
}
