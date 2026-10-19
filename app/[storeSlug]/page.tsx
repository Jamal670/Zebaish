'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ResellerStorefront } from '@/components/ResellerStorefront';
import { useApp } from '@/components/context/AppContext';
import { Product } from '@/types';

// Reserved static routes and file extensions to avoid intercepting Next.js pages or assets
const RESERVED_ROUTES = new Set([
  'about',
  'account',
  'auth',
  'cart',
  'checkout',
  'contact',
  'dashboard',
  'login',
  'order-success',
  'privacy',
  'privacy-policy',
  'product',
  'reseller',
  'shop',
  'signup',
  'store',
  'terms',
  'track',
  'verify-email',
  'api',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

export default function DynamicRootStorePage() {
  const router = useRouter();
  const params = useParams();
  const rawParam = (params?.storeSlug as string) || '';
  const storeSlug = decodeURIComponent(rawParam).trim();

  // Guard against reserved routes or special files
  if (!storeSlug || RESERVED_ROUTES.has(storeSlug.toLowerCase()) || storeSlug.startsWith('_') || storeSlug.includes('.')) {
    return null;
  }

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
      resellerId={storeSlug}
      onQuickView={(product) => setQuickViewProduct(product)}
      onAddToCart={(product) => handleAddToCart(product)}
      onToggleWishlist={handleToggleWishlist}
      wishlistIds={wishlistIds}
      onSelectProduct={handleSelectProduct}
      onNavigateHome={handleNavigateHome}
    />
  );
}
