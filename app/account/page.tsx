'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccountPage } from '@/components/AccountPage';
import { useApp } from '@/components/context/AppContext';
import { useAuth } from '@/src/hooks/useAuth';
import { Product } from '@/types';
import { Loader2 } from 'lucide-react';

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, role, loading } = useAuth();

  const rawTab = searchParams.get('tab');
  const initialTab: 'orders' | 'wishlist' | 'profile' =
    rawTab === 'wishlist' || rawTab === 'profile' ? rawTab : 'orders';

  const {
    wishlistIds,
    setQuickViewProduct,
    handleAddToCart,
    handleToggleWishlist,
  } = useApp();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
    } else if (role === 'seller') {
      // Authenticated Seller attempting to access Customer Account -> Redirect to Seller Dashboard
      router.replace('/dashboard');
    }
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-900">
        <Loader2 className="w-8 h-8 animate-spin text-stone-700 mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Loading Account...
        </p>
      </div>
    );
  }

  if (!user || role === 'seller') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-900">
        <Loader2 className="w-8 h-8 animate-spin text-stone-700 mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Redirecting to Authorized Portal...
        </p>
      </div>
    );
  }

  const handleSelectProduct = (product: Product) => {
    router.push(`/product/${product.id}`);
  };

  const handleNavigateHome = () => {
    router.push('/');
  };

  return (
    <AccountPage
      initialTab={initialTab}
      wishlistIds={wishlistIds}
      onQuickView={(product) => setQuickViewProduct(product)}
      onAddToCart={(product) => handleAddToCart(product)}
      onToggleWishlist={handleToggleWishlist}
      onSelectProduct={handleSelectProduct}
      onNavigateHome={handleNavigateHome}
    />
  );
}

export default function AccountRoutePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading account...</div>}>
      <AccountContent />
    </Suspense>
  );
}

