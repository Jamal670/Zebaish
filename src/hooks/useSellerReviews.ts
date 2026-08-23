import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [reviews, setReviews] = useState<ReviewItemData[]>([]);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Aggregate Metrics
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [ratingCounts, setRatingCounts] = useState<RatingCounts>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [productTitle, setProductTitle] = useState<string | null>(null);

  const isFetchingRef = useRef<boolean>(false);

  // 1. Fetch Aggregates & Product Info (runs when sellerId or productId changes)
  const fetchAggregates = useCallback(async () => {
    if (!sellerId) return;

    try {
      // If productId is provided, verify ownership and fetch title
      if (productId) {
        const { data: prodData, error: prodErr } = await supabase
          .from('products')
          .select('id, suit_title, seller_id')
          .eq('id', productId)
          .eq('seller_id', sellerId)
          .maybeSingle();

        if (prodErr || !prodData) {
          console.warn('Product not found or does not belong to seller:', productId);
          setProductTitle(null);
        } else {
          setProductTitle(prodData.suit_title || 'Selected Product');
        }
      } else {
        setProductTitle(null);
      }

      // Query all reviews for aggregate rating calculation (Approved only)
      let aggQuery = supabase
        .from('reviews')
        .select('rating, status, products!inner(seller_id)')
        .eq('products.seller_id', sellerId);

      if (productId) {
        aggQuery = aggQuery.eq('product_id', productId);
      }

      const { data: revAggData, error: aggErr } = await aggQuery;

      if (aggErr) {
        console.error('Error fetching review aggregates:', aggErr.message);
      } else if (revAggData) {
        const counts: RatingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let sumRating = 0;

        revAggData.forEach((r: any) => {
          const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))) as 1 | 2 | 3 | 4 | 5;
          counts[star] = (counts[star] || 0) + 1;
          sumRating += Number(r.rating) || 5;
        });

        const total = revAggData.length;
        const avg = total > 0 ? Math.round((sumRating / total) * 10) / 10 : 0;

        setTotalCount(total);
        setAverageRating(avg);
        setRatingCounts(counts);
      }
    } catch (err) {
      console.error('Unexpected error fetching review stats:', err);
    }
  }, [sellerId, productId]);

  // 2. Fetch Batch of Reviews (Paginated by 15)
  const fetchBatch = useCallback(
    async (targetPage: number, append: boolean = false) => {
      if (!sellerId || isFetchingRef.current) return;

      isFetchingRef.current = true;
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
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
          .range((targetPage - 1) * pageSize, targetPage * pageSize - 1);

        if (productId) {
          query = query.eq('product_id', productId);
        }

        const { data, error: fetchErr } = await query;

        if (fetchErr) {
          console.error('Error fetching review batch:', fetchErr.message);
          setError('Failed to load reviews.');
        } else if (data) {
          const formatted: ReviewItemData[] = data.map((item: any) => {
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

          if (formatted.length < pageSize) {
            setHasMore(false);
          } else {
            setHasMore(true);
          }

          if (append) {
            setReviews((prev) => {
              const existingIds = new Set(prev.map((r) => r.id));
              const newItems = formatted.filter((r) => !existingIds.has(r.id));
              return [...prev, ...newItems];
            });
          } else {
            setReviews(formatted);
          }
        }
      } catch (err: any) {
        console.error('Unexpected error fetching reviews:', err);
        setError('Network error while loading reviews.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [sellerId, productId, pageSize]
  );

  // Initial Load & Reset on Seller/Product Change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setReviews([]);
    fetchAggregates();
    fetchBatch(1, false);
  }, [sellerId, productId, fetchAggregates, fetchBatch]);

  // Function to load next page (for Infinite Scroll)
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore || isFetchingRef.current) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchBatch(nextPage, true);
  }, [hasMore, isLoading, isLoadingMore, page, fetchBatch]);

  return {
    reviews,
    averageRating,
    totalCount,
    ratingCounts,
    productTitle,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refetch: () => {
      setPage(1);
      setHasMore(true);
      fetchAggregates();
      fetchBatch(1, false);
    },
  };
}
