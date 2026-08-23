'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, CartItem } from '@/types';
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
  handleAddToCart: (product: Product, size?: string, quantity?: number) => void;
  handleUpdateQuantity: (productId: string, quantity: number) => void;
  handleRemoveCartItem: (productId: string) => void;
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

  // Load cart from localStorage on mount (client-side only, after hydration)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading cart from localStorage:', e);
    } finally {
      setIsCartLoaded(true);
    }
  }, []);

  // Sync cartItems state to localStorage whenever it changes (only after initial load)
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

  // Add to Cart / Bag Flow
  const handleAddToCart = (product: Product, size = 'Unstitched', quantity = 1) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.size === size
      );

      let updated: CartItem[];
      let finalQuantity = quantity;

      if (existingIndex > -1) {
        finalQuantity = prev[existingIndex].quantity + quantity;
        updated = prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: finalQuantity } : item
        );
      } else {
        updated = [...prev, { product, quantity, size }];
      }

      // Sync to DB if user is authenticated
      if (user?.id) {
        syncCartItemToDb(user.id, product.id, finalQuantity, product.price);
      }

      return updated;
    });

    showToast(`Added "${product.title}" to your Bag`);
    setIsCartOpen(true);
  };

  // Update Cart Quantity
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveCartItem(productId);
      return;
    }

    setCartItems((prev) => {
      const targetItem = prev.find((i) => i.product.id === productId);
      const updated = prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      );

      if (user?.id && targetItem) {
        syncCartItemToDb(user.id, productId, quantity, targetItem.product.price);
      }

      return updated;
    });
  };

  // Remove Cart Item
  const handleRemoveCartItem = (productId: string) => {
    setCartItems((prev) => {
      const updated = prev.filter((item) => item.product.id !== productId);
      if (user?.id) {
        syncCartItemToDb(user.id, productId, 0, 0);
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
