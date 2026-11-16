'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import supabase from '@/src/api/client';
import { DateRange, rangeToDays } from '@/lib/seller/analytics-range';
import {
  SellerAnalyticsKpis,
  RevenueTrendPoint,
  RevenueByCityPoint,
  PaymentShare,
  mapRawKpis,
  mapRevenueTrend,
  formatTopCities,
  mapPaymentShare,
} from '@/lib/seller/analytics-types';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const GC_TIME = 10 * 60 * 1000; // 10 minutes

async function callRpc<T>(fn: string, pDays: number | null, signal?: AbortSignal): Promise<T> {
  let builder = supabase.rpc(fn, { p_days: pDays });
  if (signal) {
    builder = builder.abortSignal(signal);
  }
  const { data, error } = await builder;
  if (error) {
    const msg = `${fn} failed [${error.code ?? 'no-code'}]: ${error.message}`;
    if (process.env.NODE_ENV !== 'production') console.error(msg, error);
    throw new Error(msg);
  }
  return data as T;
}

export function useSellerAnalytics(sellerId: string | null | undefined, dateRange: DateRange) {
  const queryClient = useQueryClient();
  const days = rangeToDays(dateRange);
  const isEnabled = Boolean(sellerId);

  // 1. KPI Cards Query
  const kpisQuery = useQuery({
    queryKey: ['seller-analytics', 'kpis', sellerId, dateRange],
    queryFn: async ({ signal }): Promise<SellerAnalyticsKpis> => {
      const data = await callRpc<unknown>('get_seller_analytics_kpis', days, signal);
      return mapRawKpis(data as any);
    },
    enabled: isEnabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  // 2. Revenue Trend Query
  const trendQuery = useQuery({
    queryKey: ['seller-analytics', 'revenue-trend', sellerId, dateRange],
    queryFn: async ({ signal }): Promise<RevenueTrendPoint[]> => {
      const data = await callRpc<unknown>('get_seller_revenue_trend', days, signal);
      return mapRevenueTrend(data, dateRange === 'ALL');
    },
    enabled: isEnabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  // 3. Revenue by City Query
  const cityQuery = useQuery({
    queryKey: ['seller-analytics', 'revenue-by-city', sellerId, dateRange],
    queryFn: async ({ signal }): Promise<RevenueByCityPoint[]> => {
      const data = await callRpc<RevenueByCityPoint[]>('get_seller_revenue_by_city', days, signal);
      return formatTopCities(data);
    },
    enabled: isEnabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  // 4. Payment Share Query
  const paymentQuery = useQuery({
    queryKey: ['seller-analytics', 'payment-share', sellerId, dateRange],
    queryFn: async ({ signal }): Promise<PaymentShare> => {
      const data = await callRpc<unknown>('get_seller_payment_share', days, signal);
      return mapPaymentShare(data);
    },
    enabled: isEnabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  // Prefetch data when hovering or focusing on a date range tab
  const prefetchRange = useCallback(
    (targetRange: DateRange) => {
      if (!sellerId) return;
      const targetDays = rangeToDays(targetRange);

      queryClient.prefetchQuery({
        queryKey: ['seller-analytics', 'kpis', sellerId, targetRange],
        queryFn: async () => {
          const data = await callRpc<unknown>('get_seller_analytics_kpis', targetDays);
          return mapRawKpis(data as any);
        },
        staleTime: STALE_TIME,
      });

      queryClient.prefetchQuery({
        queryKey: ['seller-analytics', 'revenue-trend', sellerId, targetRange],
        queryFn: async () => {
          const data = await callRpc<unknown>('get_seller_revenue_trend', targetDays);
          return mapRevenueTrend(data, targetRange === 'ALL');
        },
        staleTime: STALE_TIME,
      });

      queryClient.prefetchQuery({
        queryKey: ['seller-analytics', 'revenue-by-city', sellerId, targetRange],
        queryFn: async () => {
          const data = await callRpc<RevenueByCityPoint[]>('get_seller_revenue_by_city', targetDays);
          return formatTopCities(data);
        },
        staleTime: STALE_TIME,
      });

      queryClient.prefetchQuery({
        queryKey: ['seller-analytics', 'payment-share', sellerId, targetRange],
        queryFn: async () => {
          const data = await callRpc<unknown>('get_seller_payment_share', targetDays);
          return mapPaymentShare(data);
        },
        staleTime: STALE_TIME,
      });
    },
    [queryClient, sellerId]
  );

  const refetchAll = useCallback(() => {
    kpisQuery.refetch();
    trendQuery.refetch();
    cityQuery.refetch();
    paymentQuery.refetch();
  }, [kpisQuery, trendQuery, cityQuery, paymentQuery]);

  const isAnyLoading =
    kpisQuery.isPending || trendQuery.isPending || cityQuery.isPending || paymentQuery.isPending;

  const isAnyFetching =
    kpisQuery.isFetching || trendQuery.isFetching || cityQuery.isFetching || paymentQuery.isFetching;

  return {
    kpisQuery,
    trendQuery,
    cityQuery,
    paymentQuery,
    isAnyLoading,
    isAnyFetching,
    prefetchRange,
    refetchAll,
  };
}
