import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import supabase from '@/src/api/client';

export interface ReviewItemData {
  id: string;
  rating: number;
  review: string;
  status: 'Approved' | 'Pending' | 'Rejected' | string;
  createdAt: string;
  productId: string;
  productTitle: string;
  productBrand: string;
  productImage?: string;
  customerName: string;
}

export interface UseSellerReviewsOptions {
  sellerId?: string;
  productId?: string | null;
  pageSize?: number;
}

export interface RatingCounts {
  5: number;
  4: number;
  3: number;
  2: number;
  1: number;
}

export function useSellerReviews({
  sellerId,
  productId,
  pageSize = 15,
}: UseSellerReviewsOptions) {
  const [page, setPage] = useState<number>(1);
  const [accumulatedReviews, setAccumulatedReviews] = useState<ReviewItemData[]>([]);

  // 1. Fetch Aggregates & Product Info via TanStack Query (60s staleTime)
  const { data: aggregateData } = useQuery({
    queryKey: ['sellerReviewAggregates', sellerId, productId],
    queryFn: async () => {
      if (!sellerId) return null;

      let productTitle: string | null = null;
      if (productId) {
        const { data: prodData } = await supabase
          .from('products')
          .select('id, suit_title, seller_id')
          .eq('id', productId)
          .eq('seller_id', sellerId)
          .maybeSingle();

        if (prodData) {
          productTitle = prodData.suit_title || 'Selected Product';
        }
      }

      let aggQuery = supabase
        .from('reviews')
        .select('rating, status, products!inner(seller_id)')
        .eq('products.seller_id', sellerId);

      if (productId) {
        aggQuery = aggQuery.eq('product_id', productId);
      }

      const { data: revAggData } = await aggQuery;

      const counts: RatingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let sumRating = 0;
      const total = revAggData?.length || 0;

      if (revAggData) {
        revAggData.forEach((r: any) => {
          const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))) as 1 | 2 | 3 | 4 | 5;
          counts[star] = (counts[star] || 0) + 1;
          sumRating += Number(r.rating) || 5;
        });
      }

      const avg = total > 0 ? Math.round((sumRating / total) * 10) / 10 : 0;

      return {
        totalCount: total,
        averageRating: avg,
        ratingCounts: counts,
        productTitle,
      };
    },
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });

  // 2. Fetch Paginated Review Batch via TanStack Query (60s staleTime)
  const { data: batchData, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['sellerReviewBatch', sellerId, productId, page, pageSize],
    queryFn: async () => {
      if (!sellerId) return [];

      let query = supabase
        .from('reviews')
        .select(`
          id,
          rating,
          review,
          status,
          created_at,
          product_id,
          products!inner (
            id,
            seller_id,
            suit_title,
            brand,
            product_images (image_url, is_thumbnail)
          ),
          users (
            id,
            first_name,
            last_name
          )
        `)
        .eq('products.seller_id', sellerId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted: ReviewItemData[] = (data || []).map((item: any) => {
        const prod = Array.isArray(item.products) ? item.products[0] : item.products;
        const images = prod?.product_images || [];
        const thumb =
          images.find((img: any) => img.is_thumbnail)?.image_url ||
          images[0]?.image_url ||
          'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80';

        const userObj = Array.isArray(item.users) ? item.users[0] : item.users;
        const customerName = userObj?.first_name
          ? `${userObj.first_name} ${userObj.last_name || ''}`.trim()
          : 'Verified Buyer';

        return {
          id: item.id,
          rating: Number(item.rating) || 5,
          review: item.review || '',
          status: item.status || 'Approved',
          createdAt: item.created_at,
          productId: item.product_id,
          productTitle: prod?.suit_title || 'Suit Collection',
          productBrand: prod?.brand || 'Zebaish Collection',
          productImage: thumb,
          customerName,
        };
      });

      return formatted;
    },
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });

  // Sync batchData into accumulatedReviews for infinite scroll
  useEffect(() => {
    if (batchData) {
      if (page === 1) {
        setAccumulatedReviews(batchData);
      } else {
        setAccumulatedReviews((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newItems = batchData.filter((r) => !existingIds.has(r.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [batchData, page]);

  // Reset on sellerId / productId change
  useEffect(() => {
    setPage(1);
    setAccumulatedReviews([]);
  }, [sellerId, productId]);

  const hasMore = batchData ? batchData.length >= pageSize : true;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isFetching) return;
    setPage((prev) => prev + 1);
  }, [hasMore, isLoading, isFetching]);

  return {
    reviews: accumulatedReviews,
    averageRating: aggregateData?.averageRating || 0,
    totalCount: aggregateData?.totalCount || 0,
    ratingCounts: aggregateData?.ratingCounts || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    productTitle: aggregateData?.productTitle || null,
    isLoading: isLoading && page === 1,
    isLoadingMore: isFetching && page > 1,
    hasMore,
    error: isError ? 'Failed to load reviews.' : null,
    loadMore,
    refetch: () => {
      setPage(1);
      setAccumulatedReviews([]);
      refetch();
    },
  };
}
