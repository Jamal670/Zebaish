import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Star, Calendar, CheckCircle2, ChevronRight, AlertCircle, Filter, X, Loader2 } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { Product, Reseller } from '@/types';
import { formatStoreSlug, isValidUUID } from '@/src/api/sellerService';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import supabase from '@/src/api/client';
import { MOCK_RESELLERS, ALL_PRODUCTS } from '@/data/mockData';

// Constants as specified in architecture requirements
export const PAGE_SIZE = 8;
export const CATEGORY_COLUMN = 'category';
export const DEPARTMENT_FILTER_ENABLED = false;
export const PUBLIC_SELLER_COLUMNS = 'id, shop_name, full_name, store_image_url, city, status, created_at';

// Shared TanStack Query options: 5-minute cache, 10-minute gcTime, no window focus refetch, quick retry (1)
export const STOREFRONT_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // keep unused cache longer than staleTime
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

export interface CategoryFilterOption {
  value: string;
  label: string;
}

export const CATEGORY_FILTER_OPTIONS: CategoryFilterOption[] = [];

export interface ResellerStorefrontFilterState {
  sort: 'low-to-high' | 'high-to-low' | '';
  department: string;
  subcategory: string;
  /** @deprecated Kept for backwards compatibility */
  category?: string;
}

export interface StorefrontSummaryRow {
  category: string | null;
  subcategory: string | null;
  average_rating: number | null;
  review_count: number | null;
}

interface ResellerStorefrontProps {
  resellerId: string;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  wishlistIds: string[];
  onSelectProduct: (product: Product) => void;
  onNavigateHome: () => void;
  categoryOptions?: CategoryFilterOption[];
}

/**
 * Checks whether two product query keys share identical filter criteria (ignoring page).
 * Preserved for backwards compatibility.
 */
export function sameFilters(prevKey: readonly unknown[], nextKey: readonly unknown[]): boolean {
  if (!Array.isArray(prevKey) || !Array.isArray(nextKey)) return false;
  if (prevKey[0] !== nextKey[0] || prevKey[1] !== nextKey[1] || prevKey[2] !== nextKey[2]) {
    return false;
  }
  const prevFilters = prevKey[3] as { category?: string; subcategory?: string; sort?: string } | undefined;
  const nextFilters = nextKey[3] as { category?: string; subcategory?: string; sort?: string } | undefined;
  if (!prevFilters || !nextFilters) return false;

  return (
    prevFilters.category === nextFilters.category &&
    prevFilters.subcategory === nextFilters.subcategory &&
    prevFilters.sort === nextFilters.sort
  );
}

/**
 * Formats ISO date string to readable format e.g. "Jan 2024"
 */
export function formatStoreDate(dateStr?: string | null): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

/**
 * Maps raw public seller record to the Reseller type using ONLY public display fields.
 * Private columns (email, cnic, phone, address, bank info) are never selected or exposed.
 */
function mapPublicSeller(raw: any): Reseller {
  const shop = raw.shop_name || raw.full_name || 'Seller';
  return {
    id: raw.id,
    shopName: shop,
    name: raw.full_name || shop,
    store_image_url: raw.store_image_url || null,
    logo: raw.store_image_url || 'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png',
    banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop',
    city: raw.city || '',
    joinedDate: formatStoreDate(raw.created_at),
    status: raw.status || 'Active',
    description: 'Authentic 100% original designer leftover suits directly sourced from factory overstocks.',
    totalSales: 0,
    rating: 0,
    reviewCount: 0,
  } as Reseller;
}

/**
 * Request A: Fetch seller profile once selecting public display fields only.
 * Resolves by UUID or shop name / slug, with fallback for mock sellers.
 */
export async function fetchPublicSeller(identifier: string): Promise<Reseller | null> {
  if (!identifier) return null;
  const decoded = decodeURIComponent(identifier).trim();
  const normalized = formatStoreSlug(decoded);

  // 1. If valid UUID, search sellers table by id selecting ONLY public display fields
  if (isValidUUID(decoded)) {
    const { data, error } = await supabase
      .from('sellers')
      .select(PUBLIC_SELLER_COLUMNS)
      .eq('id', decoded)
      .maybeSingle();

    if (!error && data) {
      return mapPublicSeller(data);
    }
  }

  // 2. Case-insensitive exact match on shop_name selecting ONLY public display fields
  const { data: byShopName, error: shopNameErr } = await supabase
    .from('sellers')
    .select(PUBLIC_SELLER_COLUMNS)
    .ilike('shop_name', decoded)
    .maybeSingle();

  if (!shopNameErr && byShopName) {
    return mapPublicSeller(byShopName);
  }

  // 3. Match normalized slug with spaces removed
  const { data: allSellers } = await supabase
    .from('sellers')
    .select(PUBLIC_SELLER_COLUMNS);

  if (allSellers && allSellers.length > 0) {
    const matched = allSellers.find(
      (s: any) => formatStoreSlug(s.shop_name) === normalized
    );
    if (matched) return mapPublicSeller(matched);
  }

  // 4. Try replacing hyphens or underscores with spaces
  if (decoded.includes('-') || decoded.includes('_')) {
    const spaceVariant = decoded.replace(/[-_]/g, ' ');
    const { data: bySpace } = await supabase
      .from('sellers')
      .select(PUBLIC_SELLER_COLUMNS)
      .ilike('shop_name', spaceVariant)
      .maybeSingle();

    if (bySpace) return mapPublicSeller(bySpace);
  }

  // 5. Fallback for demo mock resellers (reseller-1, reseller-2)
  const mock = MOCK_RESELLERS.find(
    (r) =>
      formatStoreSlug(r.id) === normalized ||
      formatStoreSlug(r.shopName) === normalized
  );
  if (mock) return mock;

  return null;
}

/**
 * Request B: Fetch category summary once per seller.
 * Narrow select: category, subcategory, average_rating, review_count with status = 'Active'.
 */
export async function fetchStorefrontSummary(sellerId: string): Promise<StorefrontSummaryRow[]> {
  if (!sellerId) return [];

  const isMock = MOCK_RESELLERS.some((r) => r.id === sellerId);
  if (isMock || !isValidUUID(sellerId)) {
    const mockProds = ALL_PRODUCTS.filter(
      (p) => p.resellerId === sellerId || (!p.resellerId && sellerId === 'reseller-1')
    );
    if (mockProds.length > 0) {
      return mockProds.map((p) => ({
        category: p.category || null,
        subcategory: (p as any).subcategory || null,
        average_rating: Number(p.average_rating ?? p.averageRating ?? 0),
        review_count: Number(p.review_count ?? p.reviewCount ?? 0),
      }));
    }
  }

  const { data, error } = await supabase
    .from('products')
    .select(`${CATEGORY_COLUMN}, subcategory, average_rating, review_count`)
    .eq('seller_id', sellerId)
    .eq('status', 'Active');

  if (error) {
    console.warn('Error fetching storefront summary:', error);
    return [];
  }

  return (data || []) as StorefrontSummaryRow[];
}

/**
 * Request C: Products page query (8 rows per page).
 * Includes count: 'exact', server-side sorting, category/subcategory filters,
 * and thumbnail image limit 1 ordered by is_thumbnail descending.
 */
export async function fetchStorefrontProductsPage(
  sellerId: string,
  options: {
    category?: string;
    subcategory?: string;
    department?: string;
    sort?: 'low-to-high' | 'high-to-low' | '';
    page: number;
  }
): Promise<{ products: Product[]; count: number; outOfRange: boolean }> {
  if (!sellerId) {
    return { products: [], count: 0, outOfRange: false };
  }

  const isMock = MOCK_RESELLERS.some((r) => r.id === sellerId);
  if (isMock || !isValidUUID(sellerId)) {
    let list = ALL_PRODUCTS.filter(
      (p) => p.resellerId === sellerId || (!p.resellerId && sellerId === 'reseller-1')
    );

    if (options.category && options.category.toLowerCase() !== 'all') {
      list = list.filter((p) => p.category?.toLowerCase() === options.category!.toLowerCase());
    }

    if (options.subcategory) {
      list = list.filter(
        (p) =>
          ((p as any).subcategory || '').toLowerCase() === options.subcategory!.toLowerCase()
      );
    }

    if (options.sort === 'low-to-high') {
      list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    } else if (options.sort === 'high-to-low') {
      list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
    }

    const count = list.length;
    const from = (options.page - 1) * PAGE_SIZE;
    const paged = list.slice(from, from + PAGE_SIZE);

    return {
      products: paged.map((p) => ({
        ...p,
        surplus_selling_price: p.price,
        original_retail_price: p.originalPrice || p.price,
        stitchingStatus: p.category || undefined,
      })),
      count,
      outOfRange: from >= count && count > 0,
    };
  }

  const from = (options.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from('products')
    .select(
      `id, suit_title, brand, ${CATEGORY_COLUMN}, subcategory, surplus_selling_price, original_retail_price, average_rating, review_count, created_at,
       product_images(image_url, is_thumbnail)`,
      { count: 'exact' }
    )
    .eq('seller_id', sellerId)
    .eq('status', 'Active')
    .order('is_thumbnail', { referencedTable: 'product_images', ascending: false })
    .limit(1, { referencedTable: 'product_images' })
    .range(from, to);

  if (options.category && options.category.toLowerCase() !== 'all') {
    q = q.eq(CATEGORY_COLUMN, options.category);
  }

  if (options.subcategory) {
    q = q.eq('subcategory', options.subcategory);
  }

  if (DEPARTMENT_FILTER_ENABLED && options.department) {
    q = q.eq('department', options.department);
  }

  if (options.sort === 'low-to-high') {
    q = q.order('surplus_selling_price', { ascending: true }).order('id', { ascending: true });
  } else if (options.sort === 'high-to-low') {
    q = q.order('surplus_selling_price', { ascending: false }).order('id', { ascending: false });
  } else {
    q = q.order('created_at', { ascending: false }).order('id', { ascending: false });
  }

  const { data, count, error } = await q;

  if (error) {
    // Handle out-of-range pagination errors (HTTP 416 / PGRST103) safely
    if (
      error.code === 'PGRST103' ||
      String(error.message).includes('416') ||
      String(error.message).includes('range')
    ) {
      return { products: [], count: count ?? 0, outOfRange: true };
    }
    throw error;
  }

  const mappedProducts: Product[] = (data || []).map((row: any) => {
    const rawThumbnail =
      Array.isArray(row.product_images) && row.product_images.length > 0
        ? row.product_images[0]?.image_url
        : '';
    const surplus = Number(row.surplus_selling_price) || 0;
    const retail = Number(row.original_retail_price) || surplus;

    return {
      id: row.id,
      title: row.suit_title || 'Untitled Listing',
      brand: row.brand || '',
      category: row.category || '',
      subcategory: row.subcategory || '',
      stitchingStatus: row.category || undefined,
      price: surplus,
      surplus_selling_price: surplus,
      original_retail_price: retail,
      originalPrice: retail,
      currency: 'PKR',
      image:
        rawThumbnail ||
        'https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=800&auto=format&fit=crop',
      average_rating: row.average_rating,
      review_count: row.review_count,
      resellerId: sellerId,
    } as Product;
  });

  return { products: mappedProducts, count: count ?? 0, outOfRange: false };
}

/**
 * Computes pagination page numbers with ellipsis when total pages > 7.
 * Preserved for backwards compatibility.
 */
export function getPaginationPages(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

/**
 * Derives distinct category chip values from the loaded products array.
 * Preserved for backwards compatibility.
 */
export function deriveCategoryChips(products: Product[]): string[] {
  if (!Array.isArray(products) || products.length === 0) {
    return ['All'];
  }

  const seen = new Set<string>();
  const categories: string[] = [];

  for (const product of products) {
    const raw = typeof product.category === 'string' ? product.category.trim() : '';
    if (raw) {
      const lower = raw.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        categories.push(raw);
      }
    }
  }

  return ['All', ...categories];
}

/**
 * Skeleton placeholder for the seller profile hero banner.
 */
export const SellerHeaderSkeleton: React.FC = () => (
  <div aria-hidden="true" className="relative bg-stone-900 text-white overflow-hidden">
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
      {/* Mobile Skeleton */}
      <div className="md:hidden">
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-full border-2 border-stone-700 bg-stone-800 motion-safe:animate-pulse shrink-0 shadow-xl" />
          <div className="min-w-0 flex flex-col items-start gap-2 flex-1">
            <div className="w-24 h-5 rounded-xs bg-stone-800 motion-safe:animate-pulse" />
            <div className="w-36 sm:w-48 h-6 rounded bg-stone-800 motion-safe:animate-pulse" />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="w-full h-3.5 rounded bg-stone-800/80 motion-safe:animate-pulse" />
          <div className="w-4/5 h-3.5 rounded bg-stone-800/80 motion-safe:animate-pulse" />
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="w-24 h-4 rounded bg-stone-800 motion-safe:animate-pulse" />
          <div className="w-28 h-4 rounded bg-stone-800 motion-safe:animate-pulse" />
          <div className="w-20 h-4 rounded bg-stone-800 motion-safe:animate-pulse" />
        </div>
      </div>

      {/* Desktop Skeleton */}
      <div className="hidden md:flex flex-row items-center gap-6">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-stone-700 bg-stone-800 motion-safe:animate-pulse shrink-0 shadow-xl" />
        <div className="flex-1 space-y-3">
          <div className="w-28 h-5 rounded-xs bg-stone-800 motion-safe:animate-pulse" />
          <div className="w-64 sm:w-80 h-9 rounded bg-stone-800 motion-safe:animate-pulse" />
          <div className="space-y-1.5 max-w-2xl">
            <div className="w-full h-4 rounded bg-stone-800/80 motion-safe:animate-pulse" />
            <div className="w-3/4 h-4 rounded bg-stone-800/80 motion-safe:animate-pulse" />
          </div>
          <div className="pt-1 flex items-center gap-5">
            <div className="w-28 h-4 rounded bg-stone-800 motion-safe:animate-pulse" />
            <div className="w-32 h-4 rounded bg-stone-800 motion-safe:animate-pulse" />
            <div className="w-24 h-4 rounded bg-stone-800 motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Skeleton placeholder for category chips and filter button.
 */
export const ChipRowSkeleton: React.FC = () => (
  <div aria-hidden="true" className="flex items-center gap-2 mb-6">
    <div className="flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      <div className="flex w-max gap-2 py-1">
        <div className="h-10 w-16 rounded-[10px] bg-stone-200 dark:bg-stone-800 motion-safe:animate-pulse border border-stone-300/40" />
        <div className="h-10 w-24 rounded-[10px] bg-stone-200 dark:bg-stone-800 motion-safe:animate-pulse border border-stone-300/40" />
        <div className="h-10 w-28 rounded-[10px] bg-stone-200 dark:bg-stone-800 motion-safe:animate-pulse border border-stone-300/40" />
        <div className="h-10 w-20 rounded-[10px] bg-stone-200 dark:bg-stone-800 motion-safe:animate-pulse border border-stone-300/40" />
      </div>
    </div>
    <div className="shrink-0 h-10 w-10 rounded-[10px] bg-stone-200 dark:bg-stone-800 motion-safe:animate-pulse border border-stone-300/40" />
  </div>
);

/**
 * Skeleton placeholder for a single ProductCard.
 */
export const ProductCardSkeleton: React.FC = () => (
  <div
    aria-hidden="true"
    className="flex flex-col h-full bg-white dark:bg-stone-900 rounded-xl overflow-hidden border border-stone-100 dark:border-stone-800 shadow-2xs"
  >
    <div className="relative aspect-[3/4] bg-stone-200 dark:bg-stone-800 motion-safe:animate-pulse overflow-hidden" />
    <div className="p-2.5 sm:p-3.5 flex flex-col justify-between flex-1 bg-white dark:bg-stone-900 space-y-2">
      <div>
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <div className="h-3 w-16 bg-stone-200 dark:bg-stone-800 rounded-xs motion-safe:animate-pulse" />
          <div className="h-3 w-12 bg-stone-100 dark:bg-stone-800/60 rounded-xs motion-safe:animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3.5 w-full bg-stone-200 dark:bg-stone-800 rounded-xs motion-safe:animate-pulse" />
          <div className="h-3.5 w-3/4 bg-stone-200 dark:bg-stone-800 rounded-xs motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-800 space-y-1.5">
        <div className="h-4 w-20 bg-stone-200 dark:bg-stone-800 rounded-xs motion-safe:animate-pulse" />
        <div className="flex items-center justify-between pt-0.5">
          <div className="h-3 w-20 bg-stone-100 dark:bg-stone-800/60 rounded-xs motion-safe:animate-pulse" />
          <div className="h-3 w-10 bg-stone-100 dark:bg-stone-800/60 rounded-xs motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);

export const ResellerStorefront: React.FC<ResellerStorefrontProps> = ({
  resellerId,
  onQuickView,
  onAddToCart,
  onToggleWishlist,
  wishlistIds,
  onSelectProduct,
  onNavigateHome,
  categoryOptions = CATEGORY_FILTER_OPTIONS,
}) => {
  // 1. Request A: Public Seller Display Fields Only (cached for 5 minutes)
  const sellerQuery = useQuery({
    ...STOREFRONT_QUERY_OPTIONS,
    queryKey: ['storefront', 'seller', resellerId],
    queryFn: () => fetchPublicSeller(resellerId),
    enabled: Boolean(resellerId),
  });

  const seller = sellerQuery.data ?? null;
  const sellerId = seller?.id || resellerId;

  // 2. Request B: Storefront Category Summary (cached per seller, never refetched on scroll/category changes)
  const summaryQuery = useQuery({
    ...STOREFRONT_QUERY_OPTIONS,
    queryKey: ['storefront', 'summary', sellerId],
    queryFn: () => fetchStorefrontSummary(sellerId),
    enabled: Boolean(sellerId),
  });

  // State: Category chip selection, Applied filters, and Draft filters
  const [typeChip, setTypeChip] = useState<string>('All');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Applied filter state (drives Infinite Query)
  const [appliedFilters, setAppliedFilters] = useState<ResellerStorefrontFilterState>({
    sort: '',
    department: '',
    subcategory: '',
  });

  // Draft filter state (edited inside drawer; applied only upon pressing Apply)
  const [draftFilters, setDraftFilters] = useState<ResellerStorefrontFilterState>({
    sort: '',
    department: '',
    subcategory: '',
  });

  // 3. Request C: Infinite Products Query (8 products per page, automatic loading on scroll down)
  const productsInfiniteQuery = useInfiniteQuery({
    ...STOREFRONT_QUERY_OPTIONS,
    queryKey: [
      'storefront',
      'products-infinite',
      sellerId,
      {
        category: typeChip,
        subcategory: appliedFilters.subcategory,
        sort: appliedFilters.sort,
      },
    ],
    queryFn: ({ pageParam = 1 }) =>
      fetchStorefrontProductsPage(sellerId, {
        category: typeChip,
        subcategory: appliedFilters.subcategory,
        department: appliedFilters.department,
        sort: appliedFilters.sort,
        page: pageParam as number,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalCount = lastPage.count ?? 0;
      const loadedCount = allPages.length * PAGE_SIZE;
      if (loadedCount < totalCount && lastPage.products.length === PAGE_SIZE) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: Boolean(sellerId),
  });

  // Flattened products across all loaded pages
  const products = useMemo(() => {
    return productsInfiniteQuery.data?.pages.flatMap((page) => page.products) ?? [];
  }, [productsInfiniteQuery.data]);

  // Sentinel ref for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, isPending, fetchNextPage } = productsInfiniteQuery;

  // Infinite Scroll IntersectionObserver: triggers fetchNextPage() automatically on scroll down
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && !isPending) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '350px' }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [hasNextPage, isFetchingNextPage, isPending, fetchNextPage]);

  // Derivations from Request B (in-memory grouping, distinct chips, subcategory map, seller rating)
  const summaryDerivations = useMemo(() => {
    const rows = summaryQuery.data || [];
    const hasProducts = rows.length > 0;

    const seen = new Set<string>();
    const chips: string[] = ['All'];
    const subcatMap = new Map<string, Set<string>>();

    let totalReviews = 0;
    let weightedRatingSum = 0;

    for (const row of rows) {
      const cat = typeof row.category === 'string' ? row.category.trim() : '';
      const subcat = typeof row.subcategory === 'string' ? row.subcategory.trim() : '';

      if (cat) {
        const lower = cat.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          chips.push(cat);
        }

        if (subcat) {
          if (!subcatMap.has(lower)) {
            subcatMap.set(lower, new Set<string>());
          }
          subcatMap.get(lower)!.add(subcat);
        }
      }

      const rc = Number(row.review_count ?? 0);
      const ar = Number(row.average_rating ?? 0);
      if (rc > 0 && Number.isFinite(rc) && Number.isFinite(ar)) {
        totalReviews += rc;
        weightedRatingSum += ar * rc;
      }
    }

    const sellerRating = totalReviews > 0 ? weightedRatingSum / totalReviews : 0;

    return {
      hasProducts,
      categoryChips: chips,
      subcategoriesMap: subcatMap,
      sellerRating,
      sellerReviewCount: totalReviews,
    };
  }, [summaryQuery.data]);

  // Derive subcategory options for the active category chip
  const activeSubcategories = useMemo(() => {
    if (typeChip.toLowerCase() === 'all') return [];
    const set = summaryDerivations.subcategoriesMap.get(typeChip.toLowerCase());
    return set ? Array.from(set).sort() : [];
  }, [typeChip, summaryDerivations.subcategoriesMap]);

  // Handle Category Chip Click (resets infinite scroll query to page 1)
  const handleSelectCategory = (chip: string) => {
    if (chip.toLowerCase() === typeChip.toLowerCase()) return;
    setTypeChip(chip);
    setAppliedFilters((prev) => ({ ...prev, subcategory: '' }));
    setDraftFilters((prev) => ({ ...prev, subcategory: '' }));
  };

  // Filter Drawer Open & Apply Handlers
  const handleOpenFilter = () => {
    setDraftFilters(appliedFilters);
    setIsFilterOpen(true);
  };

  const handleCloseFilterWithoutApply = () => {
    setIsFilterOpen(false);
  };

  const handleResetDraftFilters = () => {
    setDraftFilters({ sort: '', department: '', subcategory: '' });
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setIsFilterOpen(false);
  };

  // SSR portal mount guard
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Accessibility and Focus trap refs
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef<boolean>(false);

  // Focus trap, Escape key, and Body scroll lock management
  useEffect(() => {
    if (!mounted) return;

    if (isFilterOpen) {
      wasOpenRef.current = true;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCloseFilterWithoutApply();
          return;
        }

        if (e.key === 'Tab' && drawerRef.current) {
          const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const focusable = Array.from(focusableElements).filter(
            (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
          );

          if (focusable.length === 0) return;

          const firstElement = focusable[0];
          const lastElement = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement || document.activeElement === drawerRef.current) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener('keydown', handleKeyDown);
        clearTimeout(timer);
      };
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      filterButtonRef.current?.focus();
    }
  }, [isFilterOpen, mounted]);

  // Clean URL slug normalization
  useEffect(() => {
    if (typeof window !== 'undefined' && seller?.shopName) {
      const cleanSlug = formatStoreSlug(seller.shopName);
      if (cleanSlug) {
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/store/')) {
          const expectedPath = `/${cleanSlug}`;
          if (currentPath !== expectedPath) {
            window.history.replaceState(null, '', expectedPath);
          }
        } else if (currentPath.includes('%20') || currentPath.includes(' ')) {
          window.history.replaceState(null, '', `/store/${cleanSlug}`);
        }
      }
    }
  }, [seller]);

  if (!sellerQuery.isPending && (sellerQuery.isError || !seller)) {
    return (
      <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in">
        <div className="bg-white border-b border-stone-200 py-3 px-4 md:px-8">
          <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-medium text-stone-500">
            <button onClick={onNavigateHome} className="hover:text-stone-900 transition-colors">
              Home
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            <span>Reseller Stores</span>
          </div>
        </div>

        <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-lg border border-stone-200 text-center space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-stone-900">Storefront Error</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Unable to fetch store details. Please verify the URL or try again.
          </p>
          <button
            onClick={() => sellerQuery.refetch()}
            className="px-5 py-2.5 bg-stone-900 text-white text-xs font-bold uppercase tracking-wider rounded-xs hover:bg-stone-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Seller rating derived across ALL products from Request B
  const sellerRating = Math.min(Math.max(summaryDerivations.sellerRating, 0), 5);
  const sellerReviewCount = Math.floor(summaryDerivations.sellerReviewCount);
  const formattedRatingText = `${sellerRating.toFixed(1)} / 5.0 (${sellerReviewCount} ${
    sellerReviewCount === 1 ? 'Review' : 'Reviews'
  })`;

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20">
      {/* Profile Header Hero Block (Renders from Request A; rating waits for Request B) */}
      {sellerQuery.isPending || !seller ? (
        <SellerHeaderSkeleton />
      ) : (
        <div className="relative bg-stone-900 text-white overflow-hidden">
          {/* Banner Image */}
          <div className="absolute inset-0 opacity-40 mix-blend-overlay">
            <img
              src={seller.banner}
              alt={seller.shopName}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
            {/* ================= MOBILE LAYOUT ================= */}
            <div className="md:hidden">
              <div className="flex items-center gap-3">
                {/* Logo */}
                <div className="relative w-20 h-20 rounded-full border-2 border-white overflow-hidden bg-stone-800 shrink-0 shadow-xl">
                  <img
                    src={
                      seller.store_image_url ||
                      seller.logo ||
                      'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png'
                    }
                    alt={seller.shopName || seller.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png';
                    }}
                  />
                </div>

                {/* Verified + Store Name */}
                <div className="min-w-0 flex flex-col items-start gap-1.5">
                  <span className="bg-amber-400 text-stone-950 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-xs">
                    VERIFIED SELLER
                  </span>

                  <h1 className="text-xl sm:text-2xl font-brand-serif font-normal tracking-wide truncate max-w-full">
                    {seller.shopName}
                  </h1>
                </div>
              </div>

              {/* Description */}
              <p className="mt-3 text-xs text-stone-300 leading-relaxed">
                {seller.description ||
                  'Authentic 100% original designer leftover suits directly sourced from factory overstocks.'}
              </p>

              {/* Mobile Stats — Rating waits for Request B */}
              <div className="mt-4 -mx-4 px-4 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-5 w-max whitespace-nowrap text-[10px]">
                  {/* Rating */}
                  {summaryQuery.isPending ? (
                    <div className="h-4 w-28 bg-stone-700/80 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-1 text-amber-400 font-bold shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 shrink-0" />
                      <span>{formattedRatingText}</span>
                    </div>
                  )}

                  {/* Member Since */}
                  <div className="flex items-center gap-1 text-stone-300 shrink-0">
                    <Calendar className="w-3 h-3 text-stone-400 shrink-0" />
                    <span>Member Since: {seller.joinedDate || 'N/A'}</span>
                  </div>

                  {/* Total Sales */}
                  <div className="flex items-center gap-1 text-stone-300 font-semibold shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{seller.totalSales || 0}+ Suits Sold</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= TABLET + DESKTOP LAYOUT ================= */}
            <div className="hidden md:flex flex-row items-center gap-6">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white overflow-hidden bg-stone-800 shrink-0 shadow-xl">
                <img
                  src={
                    seller.store_image_url ||
                    seller.logo ||
                    'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png'
                  }
                  alt={seller.shopName || seller.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png';
                  }}
                />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-amber-400 text-stone-950 text-2xs font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-xs">
                    VERIFIED RESELLER
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-brand-serif font-normal tracking-wide">
                  {seller.shopName}
                </h1>

                <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
                  {seller.description}
                </p>

                {/* Badges Row — Rating waits for Request B */}
                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                  {summaryQuery.isPending ? (
                    <div className="h-4 w-32 bg-stone-700/80 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-center space-x-1 text-amber-400 font-bold">
                      <Star className="w-4 h-4 fill-amber-400" />
                      <span>{formattedRatingText}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-1 text-stone-300">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>Member Since: {seller.joinedDate}</span>
                  </div>

                  <div className="flex items-center space-x-1 text-stone-300 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{seller.totalSales || 0}+ Suits Sold</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8"
        aria-busy={summaryQuery.isPending || productsInfiniteQuery.isPending}
      >
        {summaryQuery.isPending ? (
          <>
            <span className="sr-only" role="status">
              Loading products
            </span>
            <ChipRowSkeleton />
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
              aria-busy="true"
            >
              {Array.from({ length: 8 }).map((_, idx) => (
                <ProductCardSkeleton key={idx} />
              ))}
            </div>
          </>
        ) : !summaryDerivations.hasProducts ? (
          /* Empty State: NO chip row and NO filter button when seller has zero products overall */
          <div className="py-16 text-center bg-white rounded-lg border border-stone-200 p-8 max-w-md mx-auto space-y-2">
            <p className="text-sm font-bold text-stone-800">No products yet</p>
            <p className="text-xs text-stone-500">This reseller currently has no active surplus listings available.</p>
          </div>
        ) : (
          /* Ready State: Chip row + Filter button + Products Area */
          <>
            {/* Category Chip Row + Filter Button */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                <div className="flex w-max gap-2 py-1">
                  {summaryDerivations.categoryChips.map((chip) => {
                    const isSelected = typeChip.toLowerCase() === chip.toLowerCase();
                    return (
                      <button
                        key={chip}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectCategory(chip)}
                        className={`h-10 px-4 rounded-[10px] text-xs sm:text-sm font-semibold shrink-0 transition-colors border cursor-pointer ${
                          isSelected
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400 hover:text-stone-900'
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                ref={filterButtonRef}
                onClick={handleOpenFilter}
                className="shrink-0 h-10 w-10 rounded-[10px] border border-stone-200 bg-white text-stone-700 hover:text-stone-900 hover:border-stone-400 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                aria-label="Open filters"
                aria-haspopup="dialog"
                aria-expanded={isFilterOpen}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Products Area: Strict Precedence: isPending -> isError -> empty -> grid with infinite scroll */}
            {productsInfiniteQuery.isPending ? (
              /* 1. Skeletons while pending (initial load or category switch) */
              <div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
                aria-busy="true"
              >
                {Array.from({ length: 8 }).map((_, idx) => (
                  <ProductCardSkeleton key={idx} />
                ))}
              </div>
            ) : productsInfiniteQuery.isError ? (
              /* 2. Error state with quick Retry */
              <div className="py-16 text-center bg-white rounded-lg border border-stone-200 p-8 max-w-md mx-auto space-y-4">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                <p className="text-sm font-bold text-stone-800">Failed to load products</p>
                <p className="text-xs text-stone-500">Please check your internet connection and try again.</p>
                <button
                  type="button"
                  onClick={() => productsInfiniteQuery.refetch()}
                  className="px-4 py-2 bg-stone-900 text-white text-xs font-bold uppercase tracking-wider rounded-xs hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : products.length === 0 ? (
              /* 3. Empty state: only when query succeeded and returned 0 products */
              <div className="py-16 text-center bg-white rounded-lg border border-stone-200 p-8 max-w-md mx-auto space-y-4">
                <p className="text-sm font-bold text-stone-800">No products match your filters</p>
                <p className="text-xs text-stone-500">Try adjusting your filters or category selection.</p>
                <button
                  type="button"
                  onClick={() => {
                    setTypeChip('All');
                    setAppliedFilters({ sort: '', department: '', subcategory: '' });
                    setDraftFilters({ sort: '', department: '', subcategory: '' });
                  }}
                  className="px-4 py-2 bg-stone-900 text-white text-xs font-bold uppercase tracking-wider rounded-xs hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              /* 4. Product grid with smooth infinite scroll */
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {products.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      priority={index < 4}
                      onQuickView={onQuickView}
                      onAddToCart={onAddToCart}
                      onToggleWishlist={onToggleWishlist}
                      isWishlisted={wishlistIds.includes(product.id)}
                      onSelectProduct={onSelectProduct}
                    />
                  ))}
                </div>

                {/* Sentinel observed by IntersectionObserver for scroll-down loading */}
                <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />

                {/* Loading indicator when scrolling down loads next page of products */}
                {isFetchingNextPage && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <ProductCardSkeleton key={`infinite-skel-${idx}`} />
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-stone-600">
                      <Loader2 className="w-4 h-4 animate-spin text-stone-900" />
                      <span>Loading more suits...</span>
                    </div>
                  </div>
                )}

                {/* End of results message */}
                {!hasNextPage && products.length > 8 && (
                  <div className="py-10 text-center">
                    <p className="text-xs text-stone-400 font-medium">
                      You've reached the end • Showing all {products.length} products
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Filter Sidebar (Portal to document.body with Apply pattern) */}
      {mounted &&
        summaryDerivations.hasProducts &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 transition-opacity duration-300 ${
              isFilterOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            aria-hidden={!isFilterOpen}
          >
            {/* Dimmed Backdrop - closing without Apply discards draft */}
            <div
              onClick={handleCloseFilterWithoutApply}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
            />

            {/* Slide-in Drawer Panel from Right */}
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="filter-sidebar-title"
              tabIndex={-1}
              className={`fixed inset-y-0 right-0 w-[min(88vw,360px)] bg-white text-stone-900 shadow-2xl flex flex-col h-full z-10 transform transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                isFilterOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-3">
                  <h2 id="filter-sidebar-title" className="text-base font-bold uppercase tracking-wider text-stone-900">
                    Filter
                  </h2>
                  {(draftFilters.sort || draftFilters.department || draftFilters.subcategory) && (
                    <button
                      type="button"
                      onClick={handleResetDraftFilters}
                      className="text-xs font-semibold text-stone-500 hover:text-stone-900 underline transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={handleCloseFilterWithoutApply}
                  className="p-2 text-stone-500 hover:text-stone-900 rounded-full transition-colors cursor-pointer"
                  aria-label="Close filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Filters Content (Edits draftFilters) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-8">
                {/* Section 1: Sort by Price (Server-side ordered) */}
                <fieldset className="border-b border-stone-200 pb-5">
                  <legend className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3">
                    Sort by price
                  </legend>
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-stone-700 cursor-pointer py-1.5 px-1 hover:text-stone-900">
                      <input
                        type="radio"
                        name="filter-price-sort"
                        value="low-to-high"
                        checked={draftFilters.sort === 'low-to-high'}
                        onClick={() => {
                          if (draftFilters.sort === 'low-to-high') {
                            setDraftFilters((prev) => ({ ...prev, sort: '' }));
                          }
                        }}
                        onChange={() => setDraftFilters((prev) => ({ ...prev, sort: 'low-to-high' }))}
                        className="w-4 h-4 text-stone-900 accent-stone-900 border-stone-300 focus:ring-stone-900 cursor-pointer"
                      />
                      <span>Low to high</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-stone-700 cursor-pointer py-1.5 px-1 hover:text-stone-900">
                      <input
                        type="radio"
                        name="filter-price-sort"
                        value="high-to-low"
                        checked={draftFilters.sort === 'high-to-low'}
                        onClick={() => {
                          if (draftFilters.sort === 'high-to-low') {
                            setDraftFilters((prev) => ({ ...prev, sort: '' }));
                          }
                        }}
                        onChange={() => setDraftFilters((prev) => ({ ...prev, sort: 'high-to-low' }))}
                        className="w-4 h-4 text-stone-900 accent-stone-900 border-stone-300 focus:ring-stone-900 cursor-pointer"
                      />
                      <span>High to low</span>
                    </label>
                  </div>
                </fieldset>

                {/* Section 2: Department (UI and state preserved; query filter guarded by DEPARTMENT_FILTER_ENABLED) */}
                <fieldset className="border-b border-stone-200 pb-5">
                  <legend className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3">
                    Department
                  </legend>
                  <div className="flex flex-col gap-2">
                    {['Mens', 'Womens', 'Kids'].map((dept) => (
                      <label
                        key={dept}
                        className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-stone-700 cursor-pointer py-1 px-1 hover:text-stone-900"
                      >
                        <input
                          type="radio"
                          name="filter-department"
                          value={dept}
                          checked={draftFilters.department.toLowerCase() === dept.toLowerCase()}
                          onClick={() => {
                            if (draftFilters.department.toLowerCase() === dept.toLowerCase()) {
                              setDraftFilters((prev) => ({ ...prev, department: '' }));
                            }
                          }}
                          onChange={() => setDraftFilters((prev) => ({ ...prev, department: dept }))}
                          className="w-4 h-4 text-stone-900 accent-stone-900 border-stone-300 focus:ring-stone-900 cursor-pointer"
                        />
                        <span>{dept}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* Section 3: Collection Type (Subcategories of active category chip; hidden on 'All' or when empty) */}
                {typeChip.toLowerCase() !== 'all' && activeSubcategories.length > 0 && (
                  <fieldset className="border-b border-stone-200 pb-5">
                    <legend className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3">
                      Collection Type
                    </legend>
                    <div className="flex flex-col gap-2">
                      {activeSubcategories.map((subcat) => (
                        <label
                          key={subcat}
                          className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-stone-700 cursor-pointer py-1 px-1 hover:text-stone-900"
                        >
                          <input
                            type="radio"
                            name="filter-subcategory"
                            value={subcat}
                            checked={draftFilters.subcategory === subcat}
                            onClick={() => {
                              if (draftFilters.subcategory === subcat) {
                                setDraftFilters((prev) => ({ ...prev, subcategory: '' }));
                              }
                            }}
                            onChange={() => setDraftFilters((prev) => ({ ...prev, subcategory: subcat }))}
                            className="w-4 h-4 text-stone-900 accent-stone-900 border-stone-300 focus:ring-stone-900 cursor-pointer"
                          />
                          <span>{subcat}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>

              {/* Drawer Footer with Fixed Apply Button */}
              <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="w-full py-3 bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
