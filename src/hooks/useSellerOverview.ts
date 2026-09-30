import { useQuery } from '@tanstack/react-query';
import useAuth from './useAuth';
import {
  fetchSellerOverviewKpis,
  fetchSellerOverviewDetails,
  SellerOverviewKpisData,
  SellerOverviewDetailsData,
} from '@/src/api/sellerOverviewService';

export interface UseSellerOverviewKpisResult {
  kpis: SellerOverviewKpisData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<any>;
}

export interface UseSellerOverviewDetailsResult {
  details: SellerOverviewDetailsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<any>;
}

/**
 * Phase 1 Hook powered by TanStack Query (60s staleTime).
 */
export function useSellerOverviewKpis(explicitSellerId?: string): UseSellerOverviewKpisResult {
  const { user, resellerProfile } = useAuth();
  const sellerId = explicitSellerId || resellerProfile?.id || user?.id || 'demo-reseller-id';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sellerOverviewKpis', sellerId],
    queryFn: () => fetchSellerOverviewKpis(sellerId),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });

  return {
    kpis: data || null,
    loading: isLoading,
    error: isError ? (error as Error)?.message || 'Failed to load KPI metrics.' : null,
    refetch: async () => {
      const res = await refetch();
      return res.data;
    },
  };
}

/**
 * Phase 2 Hook powered by TanStack Query (60s staleTime).
 */
export function useSellerOverviewDetails(explicitSellerId?: string): UseSellerOverviewDetailsResult {
  const { user, resellerProfile } = useAuth();
  const sellerId = explicitSellerId || resellerProfile?.id || user?.id || 'demo-reseller-id';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sellerOverviewDetails', sellerId],
    queryFn: () => fetchSellerOverviewDetails(sellerId),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });

  return {
    details: data || null,
    loading: isLoading,
    error: isError ? (error as Error)?.message || 'Failed to load detailed charts & orders.' : null,
    refetch: async () => {
      const res = await refetch();
      return res.data;
    },
  };
}
