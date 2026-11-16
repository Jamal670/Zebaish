'use client';

import { useState, useEffect, useCallback } from 'react';
import supabase from '@/src/api/client';
import {
  SellerDashboardData,
  SellerDashboardRpcResponse,
  mapSellerDashboardData,
} from '@/lib/seller/dashboard-types';

export type SellerDashboardStatus = 'loading' | 'ready' | 'error';

export interface UseSellerDashboardResult {
  data: SellerDashboardData | null;
  status: SellerDashboardStatus;
  error: string | null;
  reload: () => void;
}

export function useSellerDashboard(): UseSellerDashboardResult {
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [status, setStatus] = useState<SellerDashboardStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setStatus('loading');
    setError(null);

    (async () => {
      try {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_seller_dashboard')
          .abortSignal(controller.signal);

        if (controller.signal.aborted) return;

        if (rpcError) {
          if (rpcError.code === 'PGRST202') {
            setError("Dashboard function isn't installed yet — apply the migration");
          } else if (rpcError.code === '42501') {
            setError('Unable to load seller dashboard right now. Please try again.');
          } else {
            setError('Failed to load dashboard metrics. Please try again.');
          }
          setStatus('error');
          return;
        }

        const mapped = mapSellerDashboardData((rpcData as SellerDashboardRpcResponse) || null);
        setData(mapped);
        setStatus('ready');
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const isAbort =
          err instanceof Error &&
          (err.name === 'AbortError' || /aborted/i.test(err.message));
        if (isAbort) return;

        setError('Failed to load dashboard metrics. Please try again.');
        setStatus('error');
      }
    })();

    return () => {
      controller.abort();
    };
  }, [reloadTick]);

  return { data, status, error, reload };
}

