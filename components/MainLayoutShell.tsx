'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { MegaMenuDrawer } from './MegaMenuDrawer';
import { SearchModal } from './SearchModal';
import { QuickViewModal } from './QuickViewModal';
import { useApp } from '@/components/context/AppContext';

export const MainLayoutShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();

  const {
    cartItems,
    handleUpdateQuantity,
    handleRemoveCartItem,
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
    handleAddToCart,
    toastMessage,
  } = useApp();

  const isResellerPortal = pathname.startsWith('/reseller') || pathname.startsWith('/dashboard');
  const hasDarkHero = pathname === '/';

  const handleNavigateHome = () => {
    router.push('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateCategory = (category: string) => {
    router.push(`/shop?category=${encodeURIComponent(category)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateCheckout = () => {
    setIsCartOpen(false);
    router.push('/checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFooterResellerClick = () => {
    router.push('/dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFooterSellerLoginClick = () => {
    router.push('/reseller/login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans flex flex-col selection:bg-stone-900 selection:text-white">
      {/* 1. Public Header Navbar */}
      {!isResellerPortal && (
        <Navbar
          onOpenMenu={() => setIsMegaMenuOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenCart={() => setIsCartOpen(true)}
          cartCount={cartItems.reduce((acc, i) => acc + i.quantity, 0)}
          wishlistCount={wishlistIds.length}
          onNavigateHome={handleNavigateHome}
          onNavigateCategory={handleNavigateCategory}
          hasDarkHero={hasDarkHero}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 ${!isResellerPortal && pathname !== '/' ? 'pt-16 sm:pt-20' : ''}`}>
        {children}
      </main>

      {/* Public Footer */}
      {!isResellerPortal && (
        <Footer
          onNavigateReseller={handleFooterResellerClick}
          onNavigateSellerLogin={handleFooterSellerLoginClick}
        />
      )}

      {/* Interactive Drawers & Modals */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveCartItem}
        onCheckout={handleNavigateCheckout}
      />

      <MegaMenuDrawer
        isOpen={isMegaMenuOpen}
        onClose={() => setIsMegaMenuOpen(false)}
        onSelectCategory={(cat) => {
          setIsMegaMenuOpen(false);
          router.push(`/shop?category=${encodeURIComponent(cat)}`);
        }}
        onSelectProduct={(product) => {
          setIsMegaMenuOpen(false);
          router.push(`/product/${product.id}`);
        }}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectProduct={(product) => {
          setIsSearchOpen(false);
          router.push(`/product/${product.id}`);
        }}
      />

      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={handleAddToCart}
        onToggleWishlist={handleToggleWishlist}
        isWishlisted={
          quickViewProduct ? wishlistIds.includes(quickViewProduct.id) : false
        }
      />

      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white text-xs font-medium px-5 py-3 rounded-md shadow-2xl flex items-center space-x-2 animate-fade-in border border-stone-800">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
