'use client';

import { useState, useEffect, useRef } from 'react';
import supabase from '@/src/api/client';
import { ProductOption, ResolvedVariant, VariantResolutionStatus } from '@/lib/product/types';

interface UseVariantResolutionProps {
  productId: string;
  options: ProductOption[];
  selection: Record<string, string | null | undefined>;
}

export interface UseVariantResolutionResult {
  variant: ResolvedVariant | null;
  status: VariantResolutionStatus;
}

/**
 * On-demand hook for variant resolution.
 * Only fires when all options have a selected value.
 * Group-counts matching rows by variant_id; row count === optionCount identifies the variant.
 * Caches combinations and aborts stale requests.
 */
export function useVariantResolution({
  productId,
  options,
  selection,
}: UseVariantResolutionProps): UseVariantResolutionResult {
  const [state, setState] = useState<UseVariantResolutionResult>({
    variant: null,
    status: 'idle',
  });

  const cacheRef = useRef<Map<string, UseVariantResolutionResult>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  // Clear cache whenever productId changes
  useEffect(() => {
    cacheRef.current.clear();
  }, [productId]);

  useEffect(() => {
    const optionCount = options?.length || 0;

    // 1. Until all options are selected, stay idle with no database query
    if (optionCount === 0) {
      setState({ variant: null, status: 'idle' });
      return;
    }

    const allSelected = options.every((opt) => Boolean(selection[opt.id]));
    if (!allSelected) {
      setState({ variant: null, status: 'idle' });
      return;
    }

    const selectedValueIds = options.map((opt) => selection[opt.id] as string);
    const cacheKey = selectedValueIds.slice().sort().join('|');

    // 2. Check cache first
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setState(cached);
      return;
    }

    // 3. Abort prior in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, status: 'loading' }));

    (async () => {
      try {
        // Run single query with inner join
        const { data, error } = await supabase
          .from('variant_option_values')
          .select(`
            variant_id, product_option_value_id,
            product_variants!inner ( id, sku, selling_price, compare_at_price, quantity, is_active )
          `)
          .eq('product_id', productId)
          .in('product_option_value_id', selectedValueIds)
          .eq('product_variants.is_active', true)
          .abortSignal(controller.signal);

        if (controller.signal.aborted) return;

        let matched: ResolvedVariant | null = null;

        if (!error && Array.isArray(data)) {
          const map = new Map<string, any[]>();
          for (const row of data) {
            const list = map.get(row.variant_id) || [];
            list.push(row);
            map.set(row.variant_id, list);
          }

          for (const [_, rows] of map.entries()) {
            if (rows.length === optionCount) {
              const rawPv = rows[0].product_variants;
              const pv = Array.isArray(rawPv) ? rawPv[0] : rawPv;
              if (pv && pv.id) {
                matched = {
                  id: pv.id,
                  sku: pv.sku || null,
                  selling_price: pv.selling_price !== null && pv.selling_price !== undefined ? Number(pv.selling_price) : null,
                  compare_at_price: pv.compare_at_price !== null && pv.compare_at_price !== undefined ? Number(pv.compare_at_price) : null,
                  quantity: pv.quantity !== null && pv.quantity !== undefined ? Number(pv.quantity) : 0,
                  is_active: Boolean(pv.is_active),
                };
                break;
              }
            }
          }
        } else {
          // Fallback if embed disambiguation fails
          let vovData: any = null;
          const { data: vovRes, error: vovError } = await supabase
            .from('variant_option_values')
            .select('variant_id, product_option_value_id')
            .eq('product_id', productId)
            .in('product_option_value_id', selectedValueIds)
            .abortSignal(controller.signal);

          if (controller.signal.aborted) return;

          if (vovError || !vovRes || vovRes.length === 0) {
            // Try alias table product_variant_option_values
            const fallbackRes = await supabase
              .from('product_variant_option_values')
              .select('variant_id, product_option_value_id')
              .eq('product_id', productId)
              .in('product_option_value_id', selectedValueIds)
              .abortSignal(controller.signal);

            if (controller.signal.aborted) return;
            vovData = fallbackRes.data || [];
          } else {
            vovData = vovRes;
          }

          const map = new Map<string, string[]>();
          for (const r of vovData || []) {
            const list = map.get(r.variant_id) || [];
            list.push(r.product_option_value_id);
            map.set(r.variant_id, list);
          }

          const candidateVariantIds = Array.from(map.entries())
            .filter(([_, vList]) => vList.length === optionCount)
            .map(([vId]) => vId);

          if (candidateVariantIds.length > 0) {
            const { data: pvList, error: pvError } = await supabase
              .from('product_variants')
              .select('id, sku, selling_price, compare_at_price, quantity, is_active')
              .in('id', candidateVariantIds)
              .eq('is_active', true)
              .abortSignal(controller.signal);

            if (controller.signal.aborted) return;
            if (pvError) throw pvError;

            if (Array.isArray(pvList) && pvList.length > 0) {
              const pv = pvList[0];
              matched = {
                id: pv.id,
                sku: pv.sku || null,
                selling_price: pv.selling_price !== null && pv.selling_price !== undefined ? Number(pv.selling_price) : null,
                compare_at_price: pv.compare_at_price !== null && pv.compare_at_price !== undefined ? Number(pv.compare_at_price) : null,
                quantity: pv.quantity !== null && pv.quantity !== undefined ? Number(pv.quantity) : 0,
                is_active: Boolean(pv.is_active),
              };
            }
          }
        }

        if (matched) {
          const res: UseVariantResolutionResult = { variant: matched, status: 'resolved' };
          cacheRef.current.set(cacheKey, res);
          setState(res);
        } else {
          const res: UseVariantResolutionResult = { variant: null, status: 'unavailable' };
          cacheRef.current.set(cacheKey, res);
          setState(res);
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setState({ variant: null, status: 'error' });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [productId, options, selection]);

  return state;
}

