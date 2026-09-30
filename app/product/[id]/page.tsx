import React from 'react';
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { fetchProductById } from '@/src/api/collectionService';
import { ProductPageClient } from './ProductPageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { id: productId } = await params;

  // Server-side (per request): create a new QueryClient instance for this request (Section D)
  const queryClient = new QueryClient();

  // Prefetch product details on server (Section C)
  if (productId) {
    await queryClient.prefetchQuery({
      queryKey: ['product', productId],
      queryFn: () => fetchProductById(productId),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductPageClient productId={productId} />
    </HydrationBoundary>
  );
}
