'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ProductDetailPage } from '@/components/ProductDetailPage';
import { useApp } from '@/components/context/AppContext';
import { Product } from '@/types';
import { useProductQuery } from '@/src/hooks/useQueries';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ProductPageClientProps {
  productId: string;
}

export function ProductPageClient({ productId }: ProductPageClientProps) {
  const router = useRouter();
  const { data, isLoading, isError } = useProductQuery(productId);

  const {
    handleAddToCart,
    handleToggleWishlist,
    wishlistIds,
  } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-stone-800" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Loading Product Details...
        </p>
      </div>
    );
  }

  const product = data?.product;
  const reviews = data?.reviews || [];

  if (isError || !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
        <p className="text-stone-500 mb-6">The product you are looking for does not exist or has been removed.</p>
        <Link
          href="/shop"
          className="px-6 py-2.5 bg-stone-900 text-white rounded-md text-sm font-semibold uppercase tracking-wider hover:bg-black transition-colors"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  const handleSelectProduct = (relProduct: Product) => {
    router.push(`/product/${relProduct.id}`);
  };

  const handleSelectReseller = (resellerId: string) => {
    router.push(`/store/${resellerId}`);
  };

  const handleNavigateHome = () => {
    router.push('/');
  };

  const handleNavigateCollection = () => {
    const cat = product.brand || product.category || 'Surplus';
    router.push(`/shop?category=${encodeURIComponent(cat)}`);
  };

  return (
    <ProductDetailPage
      product={product}
      reviews={reviews}
      onAddToCart={handleAddToCart}
      onToggleWishlist={handleToggleWishlist}
      isWishlisted={wishlistIds.includes(product.id)}
      onSelectProduct={handleSelectProduct}
      onSelectReseller={handleSelectReseller}
      onNavigateHome={handleNavigateHome}
      onNavigateCollection={handleNavigateCollection}
    />
  );
}
