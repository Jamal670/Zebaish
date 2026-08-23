'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ResellerStorefront } from '@/components/ResellerStorefront';
import { useApp } from '@/components/context/AppContext';
import { Product } from '@/types';

export default function ResellerStorePage() {
  const router = useRouter();
  const params = useParams();
  const resellerId = (params?.resellerId as string) || 'reseller-1';

  const {
    setQuickViewProduct,
    handleAddToCart,
    handleToggleWishlist,
    wishlistIds,
  } = useApp();

  const handleSelectProduct = (product: Product) => {
    router.push(`/product/${product.id}`);
  };

  const handleNavigateHome = () => {
    router.push('/');
  };

  return (
    <ResellerStorefront
      resellerId={resellerId}
      onQuickView={(product) => setQuickViewProduct(product)}
      onAddToCart={(product) => handleAddToCart(product)}
      onToggleWishlist={handleToggleWishlist}
      wishlistIds={wishlistIds}
      onSelectProduct={handleSelectProduct}
      onNavigateHome={handleNavigateHome}
    />
  );
}
