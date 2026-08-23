import { useState, useEffect, useCallback } from 'react';
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
  refetch: () => Promise<void>;
}

export interface UseSellerOverviewDetailsResult {
  details: SellerOverviewDetailsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Phase 1 Hook: Fast, lightweight fetch for Section 1 & Section 2 KPI Cards.
 * Resolves first and renders immediately.
 */
export function useSellerOverviewKpis(explicitSellerId?: string): UseSellerOverviewKpisResult {
  const { user, resellerProfile } = useAuth();
  const sellerId = explicitSellerId || resellerProfile?.id || user?.id || 'demo-reseller-id';

  const [kpis, setKpis] = useState<SellerOverviewKpisData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadKpis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSellerOverviewKpis(sellerId);
      setKpis(data);
    } catch (err: any) {
      console.error('Error fetching seller overview KPIs:', err);
      setError(err.message || 'Failed to load KPI metrics.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  return {
    kpis,
    loading,
    error,
    refetch: loadKpis,
  };
}

/**
 * Phase 2 Hook: Fetches 5 graphs data + Recent Orders table data.
 * Loaded in parallel / after Phase 1 and populates skeleton placeholders.
 */
export function useSellerOverviewDetails(explicitSellerId?: string): UseSellerOverviewDetailsResult {
  const { user, resellerProfile } = useAuth();
  const sellerId = explicitSellerId || resellerProfile?.id || user?.id || 'demo-reseller-id';

  const [details, setDetails] = useState<SellerOverviewDetailsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSellerOverviewDetails(sellerId);
      setDetails(data);
    } catch (err: any) {
      console.error('Error fetching seller overview details:', err);
      setError(err.message || 'Failed to load detailed charts & orders.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  return {
    details,
    loading,
    error,
    refetch: loadDetails,
  };
}
