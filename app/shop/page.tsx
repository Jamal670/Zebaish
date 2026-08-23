'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CollectionPage } from '@/components/CollectionPage';
import { useApp } from '@/components/context/AppContext';
import { Product } from '@/types';

function ShopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get('category') || 'ALL LEFTOVER SUITS';
  const brand = searchParams.get('brand') || undefined;

  const {
    setQuickViewProduct,
    handleAddToCart,
    handleToggleWishlist,
    wishlistIds,
  } = useApp();

  const handleSelectProduct = (product: Product) => {
    router.push(`/product/${product.id}`);
  };

  const handleSelectReseller = (resellerId: string) => {
    router.push(`/store/${resellerId}`);
  };

  const handleNavigateHome = () => {
    router.push('/');
  };

  const handleSelectBrand = (newBrand: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newBrand) {
      params.set('brand', newBrand);
      params.set('category', `${newBrand.toUpperCase()} LEFTOVER SUITS`);
    } else {
      params.delete('brand');
      params.set('category', 'ALL LEFTOVER SUITS');
    }
    router.push(`/shop?${params.toString()}`);
  };

  return (
    <CollectionPage
      categoryTitle={category}
      brandFilter={brand}
      onQuickView={(product) => setQuickViewProduct(product)}
      onAddToCart={(product) => handleAddToCart(product)}
      onToggleWishlist={handleToggleWishlist}
      wishlistIds={wishlistIds}
      onSelectProduct={handleSelectProduct}
      onSelectReseller={handleSelectReseller}
      onNavigateHome={handleNavigateHome}
      onSelectBrand={handleSelectBrand}
    />
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading collection...</div>}>
      <ShopContent />
    </Suspense>
  );
}
