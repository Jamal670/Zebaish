'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ProductDetailPage } from '@/components/ProductDetailPage';
import { useApp } from '@/components/context/AppContext';
import { Product } from '@/types';
import { useProductQuery } from '@/src/hooks/useQueries';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { formatStoreSlug } from '@/src/api/sellerService';

const EMPTY_REVIEWS: any[] = [];

interface ProductPageClientProps {
  productId: string;
}

export function ProductPageClient({ productId }: ProductPageClientProps) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useProductQuery(productId);
  const queryData: any = data;

  const {
    handleAddToCart,
    handleToggleWishlist,
    wishlistIds,
  } = useApp();

  if (isLoading && !queryData?.product) {
    return <ProductDetailPage productId={productId} isLoading={true} onAddToCart={() => {}} onToggleWishlist={() => {}} isWishlisted={false} onSelectProduct={() => {}} onNavigateHome={() => router.push('/')} onNavigateCollection={() => router.push('/shop')} />;
  }

  const product = queryData?.product;
  const reviews = queryData?.reviews || EMPTY_REVIEWS;

  if (isError || (queryData?.error && !product)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <h2 className="text-2xl font-bold text-stone-900">Failed to Load Product</h2>
        <p className="text-stone-500 max-w-md">
          {queryData?.error || 'An error occurred while fetching product details. Please try again.'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-6 py-2.5 bg-stone-900 text-white rounded-md text-sm font-semibold uppercase tracking-wider hover:bg-black transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (queryData?.notFound || !product) {
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
    const slug = formatStoreSlug(resellerId, resellerId);
    router.push(`/${slug}`);
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
