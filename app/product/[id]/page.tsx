import React from 'react';
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { fetchProductById } from '@/src/api/collectionService';
import { ProductPageClient } from './ProductPageClient';
import { notFound } from 'next/navigation';
import { isValidUuid } from '@/lib/product/fetch-product-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { id: productId } = await params;

  // UUID validation before any query — non-UUID never reaches the database
  if (!productId || !isValidUuid(productId)) {
    notFound();
  }

  // Server-side (per request): create a new QueryClient instance
  const queryClient = new QueryClient();

  // Prefetch product details on server
  const result = await fetchProductById(productId);

  // If product not found or not active/sold_out in public catalog
  if (result.notFound || (!result.product && !result.error)) {
    notFound();
  }

  await queryClient.prefetchQuery({
    queryKey: ['product', productId],
    queryFn: () => Promise.resolve(result),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductPageClient productId={productId} />
    </HydrationBoundary>
  );
}
