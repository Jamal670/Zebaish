'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, CartItem, CartItemColor } from '@/types';
import { getCartLineKey } from '@/src/utils/colorUtils';
import useAuth from '@/src/hooks/useAuth';
import {
  fetchUserWishlistIds,
  toggleDbWishlist,
  syncCartItemToDb,
  mergeGuestCartToDb,
} from '@/src/api/cartWishlistService';

interface AppContextType {
  // Cart
  cartItems: CartItem[];
  handleAddToCart: (
    product: Product,
    size?: string,
    quantity?: number,
    color?: CartItemColor | null
  ) => void;
  handleUpdateQuantity: (
    lineKeyOrProductId: string,
    quantity: number,
    size?: string,
    colorId?: string | null
  ) => void;
  handleRemoveCartItem: (
    lineKeyOrProductId: string,
    size?: string,
    colorId?: string | null
  ) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Wishlist
  wishlistIds: string[];
  handleToggleWishlist: (productId: string) => void;

  // Drawers & Modals
  isMegaMenuOpen: boolean;
  setIsMegaMenuOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  quickViewProduct: Product | null;
  setQuickViewProduct: (product: Product | null) => void;

  // Toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_CART_KEY = 'zebaish_cart_items';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Cart state initialized empty to ensure server and client initial render match (prevents SSR hydration error)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartLoaded, setIsCartLoaded] = useState(false);

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Wishlist state
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  // Modals / Drawers state
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load cart from localStorage on mount (client-side only, after hydration, with validation hygiene)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validItems: CartItem[] = [];
          for (const item of parsed) {
            if (
              item &&
              item.product &&
              typeof item.product.id === 'string' &&
              typeof item.quantity === 'number'
            ) {
              let validColor: CartItemColor | null = null;
              if (
                item.color &&
                typeof item.color === 'object' &&
                typeof item.color.id === 'string' &&
                typeof item.color.name === 'string'
              ) {
                validColor = {
                  id: item.color.id,
                  name: item.color.name,
                  code: typeof item.color.code === 'string' ? item.color.code : null,
                };
              }
              validItems.push({
                product: item.product,
                quantity: Math.max(1, item.quantity),
                size: typeof item.size === 'string' ? item.size : 'Unstitched',
                color: validColor,
                seller_id:
                  item.seller_id ||
                  item.product.resellerId ||
                  (item.product as any).seller_id ||
                  (item.product.seller as any)?.id ||
                  undefined,
              });
            }
          }
          setCartItems(validItems);
        }
      }
    } catch (e) {
      console.error('Error loading cart from localStorage, falling back to empty cart:', e);
      setCartItems([]);
    } finally {
      setIsCartLoaded(true);
    }
  }, []);

  // Sync cartItems state to localStorage whenever it changes (only after initial load, wrapped in try/catch)
  useEffect(() => {
    if (!isCartLoaded) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.error('Error saving cart to localStorage:', e);
    }
  }, [cartItems, isCartLoaded]);

  // Sync with DB when authenticated user is loaded
  useEffect(() => {
    if (user?.id) {
      // 1. Fetch user's DB wishlist IDs
      fetchUserWishlistIds(user.id).then((ids) => {
        setWishlistIds(ids);
      });

      // 2. Merge local guest cart to DB cart
      if (cartItems.length > 0) {
        mergeGuestCartToDb(user.id, cartItems);
      }
    } else {
      // If guest/unauthenticated user, clear DB-bound wishlist state
      setWishlistIds([]);
    }
  }, [user?.id]);

  // Add to Cart / Bag Flow with color snapshot support
  const handleAddToCart = (
    product: Product,
    size = 'Unstitched',
    quantity = 1,
    color?: CartItemColor | null
  ) => {
    const itemColor = color || null;
    const sellerId =
      product.resellerId ||
      (product as any).seller_id ||
      (product as any).sellerId ||
      (product.seller as any)?.id ||
      undefined;
    const targetKey = getCartLineKey({ productId: product.id, size, color: itemColor });

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => getCartLineKey(item) === targetKey
      );

      let updated: CartItem[];
      let finalQuantity = quantity;

      if (existingIndex > -1) {
        finalQuantity = prev[existingIndex].quantity + quantity;
        updated = prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: finalQuantity, seller_id: item.seller_id || sellerId }
            : item
        );
      } else {
        updated = [...prev, { product, quantity, size, color: itemColor, seller_id: sellerId }];
      }

      // Sync to DB if user is authenticated (DB sync doesn't touch client color)
      if (user?.id) {
        syncCartItemToDb(user.id, product.id, finalQuantity, product.price);
      }

      return updated;
    });

    showToast(`Added "${product.title}" to your Bag`);
    setIsCartOpen(true);
  };

  // Update Cart Quantity
  const handleUpdateQuantity = (
    lineKeyOrProductId: string,
    quantity: number,
    size?: string,
    colorId?: string | null
  ) => {
    if (quantity <= 0) {
      handleRemoveCartItem(lineKeyOrProductId, size, colorId);
      return;
    }

    setCartItems((prev) => {
      const targetIndex = prev.findIndex((item) => {
        if (getCartLineKey(item) === lineKeyOrProductId) return true;
        if (size !== undefined) {
          const itemColorId = item.color?.id ?? null;
          const targetColorId = colorId ?? null;
          const itemSize = (item.size && item.size.trim()) || 'Unstitched';
          const targetSize = (size && size.trim()) || 'Unstitched';
          return (
            item.product.id === lineKeyOrProductId &&
            itemSize === targetSize &&
            itemColorId === targetColorId
          );
        }
        return item.product.id === lineKeyOrProductId && !lineKeyOrProductId.includes(':');
      });

      if (targetIndex === -1) return prev;

      const targetItem = prev[targetIndex];
      const updated = prev.map((item, idx) =>
        idx === targetIndex ? { ...item, quantity } : item
      );

      if (user?.id && targetItem) {
        syncCartItemToDb(user.id, targetItem.product.id, quantity, targetItem.product.price);
      }

      return updated;
    });
  };

  // Remove Cart Item
  const handleRemoveCartItem = (
    lineKeyOrProductId: string,
    size?: string,
    colorId?: string | null
  ) => {
    setCartItems((prev) => {
      let removedProductId: string | null = null;
      const updated = prev.filter((item) => {
        if (getCartLineKey(item) === lineKeyOrProductId) {
          removedProductId = item.product.id;
          return false;
        }
        if (size !== undefined) {
          const itemColorId = item.color?.id ?? null;
          const targetColorId = colorId ?? null;
          const itemSize = (item.size && item.size.trim()) || 'Unstitched';
          const targetSize = (size && size.trim()) || 'Unstitched';
          if (
            item.product.id === lineKeyOrProductId &&
            itemSize === targetSize &&
            itemColorId === targetColorId
          ) {
            removedProductId = item.product.id;
            return false;
          }
        } else if (item.product.id === lineKeyOrProductId && !lineKeyOrProductId.includes(':')) {
          removedProductId = item.product.id;
          return false;
        }
        return true;
      });

      if (user?.id && removedProductId) {
        syncCartItemToDb(user.id, removedProductId, 0, 0);
      }
      return updated;
    });
    showToast('Removed item from Bag');
  };

  const clearCart = () => {
    setCartItems([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_CART_KEY);
    }
  };

  // Wishlist Flow
  const handleToggleWishlist = (productId: string) => {
    // 1. Check whether user is authenticated
    if (!user) {
      showToast('Please log in first to save items to your Wishlist');
      return;
    }

    // 2. Optimistically update local wishlistIds state
    const isWishlisted = wishlistIds.includes(productId);
    if (isWishlisted) {
      setWishlistIds((prev) => prev.filter((id) => id !== productId));
      showToast('Removed item from Wishlist');
    } else {
      setWishlistIds((prev) => [...prev, productId]);
      showToast('Saved item to Wishlist');
    }

    // 3. Synchronize with Database wishlist & wishlist_items tables
    toggleDbWishlist(user.id, productId).catch((err) => {
      console.error('Failed to sync wishlist to DB:', err);
      // Revert optimistic update on failure
      setWishlistIds((prev) =>
        isWishlisted ? [...prev, productId] : prev.filter((id) => id !== productId)
      );
      showToast('Failed to update wishlist. Please try again.');
    });
  };

  return (
    <AppContext.Provider
      value={{
        cartItems,
        handleAddToCart,
        handleUpdateQuantity,
        handleRemoveCartItem,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        wishlistIds,
        handleToggleWishlist,
        isMegaMenuOpen,
        setIsMegaMenuOpen,
        isSearchOpen,
        setIsSearchOpen,
        quickViewProduct,
        setQuickViewProduct,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
