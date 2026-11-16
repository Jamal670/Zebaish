'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import supabase from '@/src/api/client';
import { fetchProductDetail, isValidUuid } from '@/lib/product/fetch-product-detail';
import { ProductDetail, ProductOption, SpecRow } from '@/lib/product/types';

export type ProductDetailStatus = 'loading' | 'ready' | 'notFound' | 'error';

export interface UseProductDetailResult {
  product: ProductDetail | null;
  images: string[];
  specs: SpecRow[];
  options: ProductOption[];
  optionImages: Map<string, string>;
  status: ProductDetailStatus;
  retry: () => void;
}

/**
 * Single hook for initial product detail loading (Query 1 + Query 2a/2b in parallel).
 * Aborts in-flight requests on unmount / id change, ignoring stale responses.
 */
export function useProductDetail(id: string): UseProductDetailResult {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [optionImages, setOptionImages] = useState<Map<string, string>>(new Map());
  const [status, setStatus] = useState<ProductDetailStatus>('loading');

  const [reloadTrigger, setReloadTrigger] = useState(0);
  const retry = useCallback(() => {
    setReloadTrigger((count) => count + 1);
  }, []);

  const activeIdRef = useRef(id);
  activeIdRef.current = id;

  useEffect(() => {
    const cleanId = (id || '').trim();

    // 1. UUID validation before any query
    if (!cleanId || !isValidUuid(cleanId)) {
      setProduct(null);
      setImages([]);
      setSpecs([]);
      setOptions([]);
      setOptionImages(new Map());
      setStatus('notFound');
      return;
    }

    setStatus('loading');

    const controller = new AbortController();

    fetchProductDetail(supabase, cleanId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted || activeIdRef.current !== cleanId) {
          return;
        }

        if (res.notFound) {
          setProduct(null);
          setImages([]);
          setSpecs([]);
          setOptions([]);
          setOptionImages(new Map());
          setStatus('notFound');
          return;
        }

        if (res.error || !res.product) {
          setProduct(null);
          setImages([]);
          setSpecs([]);
          setOptions([]);
          setOptionImages(new Map());
          setStatus('error');
          return;
        }

        setProduct(res.product);
        setImages(res.images);
        setSpecs(res.specs);
        setOptions(res.options);
        setOptionImages(res.optionImages);
        setStatus('ready');
      })
      .catch((err) => {
        if (controller.signal.aborted || activeIdRef.current !== cleanId) {
          return;
        }
        setStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [id, reloadTrigger]);

  return {
    product,
    images,
    specs,
    options,
    optionImages,
    status,
    retry,
  };
}

