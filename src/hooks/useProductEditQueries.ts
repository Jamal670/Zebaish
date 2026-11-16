import { useQuery } from '@tanstack/react-query';
import {
  fetchSectionCore,
  fetchSectionAttributes,
  fetchSectionVariations,
  fetchSectionOptionImages,
  ProductEditCoreData,
  ProductEditAttributesData,
  ProductEditVariationsData,
  ProductOptionImageData,
} from '@/src/api/productEditService';

// ============================================================================
// KEY FACTORY (Section 3)
// ============================================================================

export const productEditKeys = {
  all: (sellerId?: string | null, productId?: string | null) =>
    ['product-edit', sellerId || '', productId || ''] as const,
  core: (sellerId?: string | null, productId?: string | null) =>
    ['product-edit', sellerId || '', productId || '', 'core'] as const,
  attributes: (sellerId?: string | null, productId?: string | null) =>
    ['product-edit', sellerId || '', productId || '', 'attributes'] as const,
  variations: (sellerId?: string | null, productId?: string | null) =>
    ['product-edit', sellerId || '', productId || '', 'variations'] as const,
  optionImages: (productId?: string | null) =>
    ['product-edit', productId || '', 'option-images'] as const,
};

// Edit snapshots must never outlive the edit screen. The listing can be written to
// outside the form (for example the auto-activation performed when clicking Edit in
// ListingsView bumps products.updated_at), and initializing the form from an old
// snapshot makes the update RPC reject the save with a false CONFLICT.
export const PRODUCT_EDIT_STALE_TIME = 0;
export const PRODUCT_EDIT_GC_TIME = 0;

// ============================================================================
// SECTION HOOKS (Section 3)
// ============================================================================

/**
 * Hook 1: Core product details, primary images, category and parent.
 * Key: ['product-edit', sellerId, productId, 'core']
 */
export function useProductEditCoreQuery(
  productId?: string | null,
  sellerId?: string | null,
  enabled: boolean = true
) {
  const isApplicable = Boolean(productId && sellerId && enabled);
  return useQuery<ProductEditCoreData | null>({
    queryKey: productEditKeys.core(sellerId, productId),
    queryFn: ({ signal }) => fetchSectionCore(productId!, sellerId!, signal),
    enabled: isApplicable,
    staleTime: PRODUCT_EDIT_STALE_TIME,
    gcTime: PRODUCT_EDIT_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook 2: Attribute values (with category definitions) and custom specifications.
 * Key: ['product-edit', sellerId, productId, 'attributes']
 */
export function useProductEditAttributesQuery(
  productId?: string | null,
  sellerId?: string | null,
  enabled: boolean = true
) {
  const isApplicable = Boolean(productId && sellerId && enabled);
  return useQuery<ProductEditAttributesData>({
    queryKey: productEditKeys.attributes(sellerId, productId),
    queryFn: ({ signal }) => fetchSectionAttributes(productId!, signal),
    enabled: isApplicable,
    staleTime: PRODUCT_EDIT_STALE_TIME,
    gcTime: PRODUCT_EDIT_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook 3: Variation dimensions, options, values, and active variants.
 * Enabled only when core is loaded AND inventory_mode === 'variants'.
 * Key: ['product-edit', sellerId, productId, 'variations']
 */
export function useProductEditVariationsQuery(
  productId?: string | null,
  sellerId?: string | null,
  enabled: boolean = true
) {
  const isApplicable = Boolean(productId && sellerId && enabled);
  return useQuery<ProductEditVariationsData>({
    queryKey: productEditKeys.variations(sellerId, productId),
    queryFn: ({ signal }) => fetchSectionVariations(productId!, signal),
    enabled: isApplicable,
    staleTime: PRODUCT_EDIT_STALE_TIME,
    gcTime: PRODUCT_EDIT_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook 4: Option value images. Enabled ONLY inside the variation page.
 * Key: ['product-edit', productId, 'option-images']
 */
export function useProductEditOptionImagesQuery(
  productId?: string | null,
  enabled: boolean = true
) {
  const isApplicable = Boolean(productId && enabled);
  return useQuery<ProductOptionImageData[]>({
    queryKey: productEditKeys.optionImages(productId),
    queryFn: ({ signal }) => fetchSectionOptionImages(productId!, signal),
    enabled: isApplicable,
    staleTime: PRODUCT_EDIT_STALE_TIME,
    gcTime: PRODUCT_EDIT_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
