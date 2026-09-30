import { useQuery } from '@tanstack/react-query';
import useAuth from './useAuth';
import {
  fetchSellerLast7DaysData,
  SellerLast7DaysData,
} from '@/src/api/sellerLast7DaysService';

export interface UseSellerLast7DaysResult {
  data: SellerLast7DaysData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<any>;
}

export function useSellerLast7Days(explicitSellerId?: string): UseSellerLast7DaysResult {
  const { user, resellerProfile } = useAuth();
  const sellerId = explicitSellerId || resellerProfile?.id || user?.id || 'demo-reseller-id';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sellerLast7Days', sellerId],
    queryFn: () => fetchSellerLast7DaysData(sellerId),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });

  return {
    data: data || null,
    loading: isLoading,
    error: isError ? (error as Error)?.message || 'Failed to fetch last 7 days performance metrics.' : null,
    refetch: async () => {
      const res = await refetch();
      return res.data;
    },
  };
}

export default useSellerLast7Days;
