import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProductById,
  incrementProductViews,
  fetchCollectionProducts,
  FetchCollectionParams,
} from '@/src/api/collectionService';
import { fetchSellerOverviewKpis, fetchSellerOverviewDetails } from '@/src/api/sellerOverviewService';
import { fetchSellerLast7DaysData } from '@/src/api/sellerLast7DaysService';
import { fetchSellerAnalyticsData } from '@/src/api/sellerAnalyticsService';
import { fetchSellerOrders } from '@/src/api/sellerOrdersService';
import { fetchSellerWalletKpis } from '@/src/api/sellerWalletService';
import { fetchSellerFullProfile } from '@/src/api/sellerProfileService';
import { fetchSellerStorefrontData } from '@/src/api/sellerService';
import {
  fetchTopLevelDepartments,
  fetchCategoriesByDepartment,
  fetchCategoryAttributeDefinitions,
  CategoryRecord,
  CategoryAttributeDefinition,
} from '@/src/api/categoryService';
import {
  fetchProductInformation,
  ProductInformationData,
  fetchProductForEdit,
  ProductEditData,
} from '@/src/api/productService';
import supabase from '@/src/api/client';

// ==========================================
// CACHE CONSTANTS (SELLER PRODUCTS & DETAILS)
// ==========================================

export const SELLER_PRODUCTS_STALE_TIME = 5 * 60 * 1000; // 5 minutes
export const SELLER_PRODUCTS_GC_TIME = 10 * 60 * 1000; // 10 minutes

export const PRODUCT_INFORMATION_STALE_TIME = 60 * 1000; // 1 minute
export const PRODUCT_INFORMATION_GC_TIME = 5 * 60 * 1000; // 5 minutes

// ==========================================
// 1. PRODUCT DETAIL QUERY & MUTATION HOOKS
// ==========================================

/**
 * Fetches product detail, seller info, variants, and reviews in a single query.
 * Applied staleTime: 3 minutes (3 * 60 * 1000) for ProductDetailPage per Section B & Section 3.
 */
export function useProductQuery(productId: string) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProductById(productId),
    enabled: Boolean(productId),
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

/**
 * Background fire-and-forget view count increment.
 * CRITICAL PER SECTION B: DOES NOT invalidate or refetch ['product', productId] on success.
 */
export function useIncrementViewsMutation() {
  return useMutation({
    mutationFn: (productId: string) => incrementProductViews(productId),
    // Intentionally NO query invalidation to preserve performance
  });
}

// ==========================================
// 2. COLLECTION / SHOP QUERY HOOK
// ==========================================

/**
 * Fetches collection products with database-level sorting, filtering, and pagination.
 * Applied staleTime: 3 minutes (3 * 60 * 1000) for CollectionPage per Section B & Section 3.
 */
export function useCollectionProductsQuery(params: FetchCollectionParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => fetchCollectionProducts(params),
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

// ==========================================
// 3. RESELLER / SELLER PRODUCTS HOOKS
// ==========================================

/**
 * Fetches products listed by an authenticated seller for ListingsView.
 * Key: ['seller-products', sellerId]
 * Stale time: 5 minutes, GC time: 10 minutes.
 * Thumbnail embedded without !inner so products with no thumbnail still appear.
 */
export function useSellerProductsQuery(sellerId?: string) {
  return useQuery({
    queryKey: ['seller-products', sellerId],
    queryFn: async () => {
      if (!sellerId) return [];
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, title, status, inventory_mode, selling_price, quantity,
          cached_min_variant_price, cached_max_variant_price, cached_total_variant_quantity,
          views, created_at,
          product_images ( id, storage_path, image_url, alt_text, is_thumbnail )
        `)
        .eq('seller_id', sellerId)
        .eq('product_images.is_thumbnail', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(sellerId),
    staleTime: SELLER_PRODUCTS_STALE_TIME,
    gcTime: SELLER_PRODUCTS_GC_TIME,
  });
}

/**
 * Fetches comprehensive product details for the Product Information Modal.
 * Runs ONLY when selectedProductId and sellerId are present (lazy on-click).
 * Key: ['product-information', sellerId, productId]
 * Stale time: 1 minute, GC time: 5 minutes.
 */
export function useProductInformationQuery(productId?: string | null, sellerId?: string) {
  return useQuery({
    queryKey: ['product-information', sellerId, productId],
    queryFn: () => fetchProductInformation(productId!, sellerId!),
    enabled: Boolean(productId && sellerId),
    staleTime: PRODUCT_INFORMATION_STALE_TIME,
    gcTime: PRODUCT_INFORMATION_GC_TIME,
  });
}

/**
 * Fetches fresh product data on mount for the edit collection screen.
 * Key: ['product-edit', sellerId, productId]
 * staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false
 */
export function useProductEditQuery(productId?: string | null, sellerId?: string) {
  return useQuery({
    queryKey: ['product-edit', sellerId, productId],
    queryFn: () => fetchProductForEdit(productId!, sellerId!),
    enabled: Boolean(productId && sellerId),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export * from './useProductEditQueries';

// ==========================================
// 4. RESELLER DASHBOARD OVERVIEW & ANALYTICS
// ==========================================

export function useSellerOverviewKpisQuery(sellerId?: string) {
  return useQuery({
    queryKey: ['sellerOverviewKpis', sellerId],
    queryFn: () => fetchSellerOverviewKpis(sellerId!),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });
}

export function useSellerOverviewDetailsQuery(sellerId?: string) {
  return useQuery({
    queryKey: ['sellerOverviewDetails', sellerId],
    queryFn: () => fetchSellerOverviewDetails(sellerId!),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });
}

export function useSellerLast7DaysQuery(sellerId?: string) {
  return useQuery({
    queryKey: ['sellerLast7Days', sellerId],
    queryFn: () => fetchSellerLast7DaysData(sellerId!),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });
}

export function useSellerAnalyticsQuery(sellerId?: string, timeframe: '7D' | '30D' | '90D' | 'ALL' = '30D') {
  return useQuery({
    queryKey: ['sellerAnalytics', sellerId, timeframe],
    queryFn: () => fetchSellerAnalyticsData({ sellerId: sellerId!, dateRange: timeframe }),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });
}

// ==========================================
// 5. RESELLER ORDERS & MUTATIONS
// ==========================================

export function useSellerOrdersQuery(sellerId?: string) {
  return useQuery({
    queryKey: ['sellerOrders', sellerId],
    queryFn: () => fetchSellerOrders({ sellerId: sellerId! }),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });
}

// ==========================================
// 6. RESELLER WALLET & PAYOUTS
// ==========================================

export function useSellerWalletQuery(sellerId?: string) {
  return useQuery({
    queryKey: ['sellerWallet', sellerId],
    queryFn: () => fetchSellerWalletKpis(sellerId!),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });
}

// ==========================================
// 7. RESELLER PROFILE & SETTINGS
// ==========================================

export function useSellerProfileQuery(sellerId?: string) {
  return useQuery({
    queryKey: ['sellerProfile', sellerId],
    queryFn: () => fetchSellerFullProfile(sellerId!),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });
}

// ==========================================
// 8. RESELLER STOREFRONT
// ==========================================

export function useSellerStorefrontQuery(sellerId?: string) {
  return useQuery({
    queryKey: ['sellerStorefront', sellerId],
    queryFn: () => fetchSellerStorefrontData(sellerId!),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
  });
}

// ==========================================
// 9. NEW LISTING MUTATION
// ==========================================

export function useNewListingMutation(sellerId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productData: any) => {
      const { data, error } = await supabase.from('products').insert([productData]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (sellerId) {
        queryClient.invalidateQueries({ queryKey: ['seller-products', sellerId] });
        queryClient.invalidateQueries({ queryKey: ['sellerProducts', sellerId] });
      }
    },
  });
}

// ==========================================
// 10. BRAND NAMES QUERY
// ==========================================

/**
 * Fetches brand names from `brandNames` table selecting only `brandsName`.
 * Configured with 10-minute staleTime and fast response path.
 */
export function useBrandNamesQuery() {
  return useQuery({
    queryKey: ['brandNames'],
    queryFn: async () => {
      try {
        // Fetch all records from brandNames table retrieving brandsName field
        let { data, error } = await supabase
          .from('brandnames')
          .select('brandsName');

        if (error) {
          console.warn('Error querying brandNames table:', error.message);
          // Fallback query if table name case or schema differs
          const fallback = await supabase.from('brand_names').select('brandsName');
          if (!fallback.error && fallback.data) {
            data = fallback.data;
            error = null;
          }
        }

        if (data && Array.isArray(data)) {
          const names = data
            .map((item: any) => item?.brandsName || item?.brand_name || item?.name)
            .filter((name: any): name is string => typeof name === 'string' && name.trim().length > 0);
          return names;
        }
        return [];
      } catch (err) {
        console.warn('Failed to fetch brandNames:', err);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

// ==========================================
// 11. CATEGORY & DEPARTMENT QUERIES
// ==========================================

/**
 * Fetches top-level categories (departments) where parent_id is null and is_active = true.
 * Shared long cache with automatic background refetching.
 */
export function useDepartmentsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['categories', 'departments'],
    queryFn: () => fetchTopLevelDepartments(),
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetches child categories for a selected department ID (parent_id = departmentId).
 * Only fires when departmentId is truthy.
 */
export function useCategoriesByDepartmentQuery(
  departmentId?: string | null,
  options?: { enabled?: boolean }
) {
  const isEnabled = options?.enabled !== undefined ? Boolean(departmentId && options.enabled) : Boolean(departmentId);
  return useQuery({
    queryKey: ['categories', 'children', departmentId],
    queryFn: () => fetchCategoriesByDepartment(departmentId!),
    enabled: isEnabled,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetches attribute definitions for a selected category ID from category_attribute_definitions table.
 * Only fires when categoryId is truthy.
 */
export function useCategoryAttributeDefinitionsQuery(categoryId?: string | null) {
  return useQuery({
    queryKey: ['categoryAttributes', categoryId],
    queryFn: () => fetchCategoryAttributeDefinitions(categoryId!),
    enabled: Boolean(categoryId),
    staleTime: 10 * 60 * 1000,
  });
}


