'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabase';
import {
  RawReviewBreakdownRow,
  RawSellerReviewRow,
  ReviewItemData,
  RatingCounts,
  mapBreakdownSummary,
  mapReviewItem,
} from '@/lib/reviews/review-types';

export * from '@/lib/reviews/review-types';

export const PAGE_SIZE = 50;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UseSellerReviewsOptions {
  sellerId?: string;
  productId?: string | null;
}

export function useSellerReviews(options?: UseSellerReviewsOptions) {
  const searchParams = useSearchParams();

  // Validate productId from options or URL searchParams
  const rawParamId = options?.productId !== undefined ? options.productId : searchParams?.get('productId');
  const validProductId = useMemo(() => {
    if (typeof rawParamId === 'string' && UUID_REGEX.test(rawParamId.trim())) {
      return rawParamId.trim();
    }
    return null;
  }, [rawParamId]);

  const [reloadKey, setReloadKey] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);

  // Breakdown state
  const [breakdownRows, setBreakdownRows] = useState<RawReviewBreakdownRow[]>([]);
  const [isBreakdownLoading, setIsBreakdownLoading] = useState<boolean>(true);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  // List state
  const [reviews, setReviews] = useState<ReviewItemData[]>([]);
  const [totalCountFromRpc, setTotalCountFromRpc] = useState<number | null>(null);
  const [isListLoading, setIsListLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);

  // Product title state (for product-scoped view)
  const [productTitle, setProductTitle] = useState<string | null>(null);

  // Flag for missing migration RPC (PGRST202)
  const [isMissingRpc, setIsMissingRpc] = useState<boolean>(false);

  // AbortController refs for in-flight requests
  const activeControllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    setOffset(0);
    setReloadKey((k) => k + 1);
  }, []);

  // Fetch initial batch (Breakdown + List offset 0 + Product Title)
  useEffect(() => {
    // Abort previous in-flight requests
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;

    setIsBreakdownLoading(true);
    setIsListLoading(true);
    setIsLoadingMore(false);
    setBreakdownError(null);
    setListError(null);
    setIsMissingRpc(false);
    setOffset(0);
    setReviews([]);
    setTotalCountFromRpc(null);
    setProductTitle(null);

    // If filtered to a specific product, fetch its title in parallel
    if (validProductId) {
      (async () => {
        try {
          const res: any = await supabase
            .from('products')
            .select('title')
            .eq('id', validProductId)
            .abortSignal(controller.signal)
            .maybeSingle();

          if (!controller.signal.aborted && res?.data?.title) {
            setProductTitle(res.data.title);
          }
        } catch {
          // Ignore title lookup failure
        }
      })();
    }

    // Call both RPCs in parallel with Promise.allSettled
    const breakdownCall = supabase
      .rpc('get_seller_review_breakdown', { p_product_id: validProductId })
      .abortSignal(controller.signal);

    const listCall = supabase
      .rpc('get_seller_reviews', {
        p_product_id: validProductId,
        p_limit: PAGE_SIZE,
        p_offset: 0,
      })
      .abortSignal(controller.signal);

    Promise.allSettled([breakdownCall, listCall]).then(([breakdownRes, listRes]) => {
      if (controller.signal.aborted) return;

      // Handle Breakdown Result
      if (breakdownRes.status === 'fulfilled') {
        const { data, error } = breakdownRes.value as any;
        if (error) {
          if (error.code === 'PGRST202' || error.message?.includes('get_seller_review_breakdown')) {
            setIsMissingRpc(true);
            setBreakdownError('Migration required: Please apply supabase/migrations/20261113_seller_reviews_rpcs.sql.');
          } else {
            setBreakdownError(error.message || 'Failed to load rating breakdown.');
          }
        } else if (Array.isArray(data)) {
          setBreakdownRows(data);
        }
      } else {
        const reason = breakdownRes.reason;
        if (reason?.name !== 'AbortError') {
          setBreakdownError(reason?.message || 'Failed to load rating breakdown.');
        }
      }
      setIsBreakdownLoading(false);

      // Handle Reviews List Result
      if (listRes.status === 'fulfilled') {
        const { data, error } = listRes.value as any;
        if (error) {
          if (error.code === 'PGRST202' || error.message?.includes('get_seller_reviews')) {
            setIsMissingRpc(true);
            setListError('Migration required: Please apply supabase/migrations/20261113_seller_reviews_rpcs.sql.');
          } else {
            setListError(error.message || 'Failed to load reviews list.');
          }
        } else if (Array.isArray(data)) {
          const mapped = data.map((r: RawSellerReviewRow) => mapReviewItem(r));
          setReviews(mapped);
          if (data.length > 0 && data[0].total_count !== undefined) {
            setTotalCountFromRpc(Number(data[0].total_count) || mapped.length);
          } else {
            setTotalCountFromRpc(0);
          }
        }
      } else {
        const reason = listRes.reason;
        if (reason?.name !== 'AbortError') {
          setListError(reason?.message || 'Failed to load reviews list.');
        }
      }
      setIsListLoading(false);
    });

    return () => {
      controller.abort();
    };
  }, [validProductId, reloadKey]);

  // Derived Breakdown Metrics (1 decimal average, zero-filled counts, total)
  const { totalCount: breakdownTotal, averageRating, ratingCounts } = useMemo(() => {
    return mapBreakdownSummary(breakdownRows);
  }, [breakdownRows]);

  // Total count matches the breakdown total or list count
  const effectiveTotalCount = totalCountFromRpc !== null ? totalCountFromRpc : breakdownTotal;

  // Pagination / Load More handler
  const hasMore = reviews.length < effectiveTotalCount;

  const loadMore = useCallback(async () => {
    if (!hasMore || isListLoading || isLoadingMore) return;

    const nextOffset = reviews.length;
    setIsLoadingMore(true);

    const controller = new AbortController();

    try {
      const res: any = await supabase
        .rpc('get_seller_reviews', {
          p_product_id: validProductId,
          p_limit: PAGE_SIZE,
          p_offset: nextOffset,
        })
        .abortSignal(controller.signal);

      setIsLoadingMore(false);
      if (res?.error) {
        setListError(res.error.message || 'Failed to load more reviews.');
      } else if (Array.isArray(res?.data)) {
        const newItems = res.data.map((r: RawSellerReviewRow) => mapReviewItem(r));
        setReviews((prev) => {
          const existing = new Set(prev.map((i: any) => i.id));
          const fresh = newItems.filter((i: any) => !existing.has(i.id));
          return [...prev, ...fresh];
        });
        setOffset(nextOffset);
      }
    } catch (err: any) {
      setIsLoadingMore(false);
      if (err?.name !== 'AbortError') {
        setListError(err?.message || 'Failed to load more reviews.');
      }
    }
  }, [hasMore, isListLoading, isLoadingMore, reviews.length, validProductId]);

  return {
    reviews,
    averageRating,
    totalCount: effectiveTotalCount,
    ratingCounts,
    productTitle,
    isBreakdownLoading,
    isListLoading,
    isLoading: isBreakdownLoading || (isListLoading && reviews.length === 0),
    isLoadingMore,
    hasMore,
    breakdownError,
    listError,
    error: isMissingRpc
      ? 'Database migration required: Please execute supabase/migrations/20261113_seller_reviews_rpcs.sql in your Supabase SQL editor.'
      : (listError || breakdownError),
    isMissingRpc,
    loadMore,
    reload,
    refetch: reload,
  };
}

export default useSellerReviews;
