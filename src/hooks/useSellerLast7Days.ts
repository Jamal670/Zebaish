import { useState, useEffect, useCallback } from 'react';
import useAuth from './useAuth';
import {
  fetchSellerLast7DaysData,
  SellerLast7DaysData,
} from '@/src/api/sellerLast7DaysService';

export interface UseSellerLast7DaysResult {
  data: SellerLast7DaysData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSellerLast7Days(explicitSellerId?: string): UseSellerLast7DaysResult {
  const { user, resellerProfile } = useAuth();
  const sellerId = explicitSellerId || resellerProfile?.id || user?.id || 'demo-reseller-id';

  const [data, setData] = useState<SellerLast7DaysData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSellerLast7DaysData(sellerId);
      setData(result);
    } catch (err: any) {
      console.error('Error in useSellerLast7Days hook:', err);
      setError(err.message || 'Failed to fetch last 7 days performance metrics.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refetch: loadData,
  };
}

export default useSellerLast7Days;
