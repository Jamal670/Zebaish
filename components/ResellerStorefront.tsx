import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Star, Calendar, CheckCircle2, ChevronRight, AlertCircle, Filter, X, Loader2 } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { Product } from '@/types';
import { formatStoreSlug } from '@/src/api/sellerService';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  STOREFRONT_GC_TIME,
  STOREFRONT_PAGE_SIZE,
  STOREFRONT_PLACEHOLDER_IMAGE,
  STOREFRONT_STALE_TIME,
  StorefrontProduct,
  StorefrontSort,
  collectPendingVariantIds,
  fetchSeller,
  fetchSellerCategories,
  fetchSellerProducts,
  fetchVariantPrices,
  groupCategoriesByName,
  isActiveSellerStatus,
  normalizeShopIdentifier,
  pickThumbnailUrl,
  resolveProductPrice,
  summarizeRatings,
} from '@/src/api/storefrontService';

/** Department filtering is part of the drawer UI but stays disabled (no server-side column). */
export const DEPARTMENT_FILTER_ENABLED = false;

/** Static header artwork: the schema has no banner or description column for sellers. */
const STOREFRONT_BANNER_IMAGE =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop';
const STOREFRONT_STORE_LOGO =
  'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png';
const STOREFRONT_DESCRIPTION =
  '';

/** Shared TanStack Query options: 5-minute cache, 10-minute gcTime, quick retry (1). */
const STOREFRONT_QUERY_OPTIONS = {
  staleTime: STOREFRONT_STALE_TIME,
  gcTime: STOREFRONT_GC_TIME,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

export interface ResellerStorefrontFilterState {
  sort: StorefrontSort;
  department: string;
}

interface ResellerStorefrontProps {
  resellerId: string;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  wishlistIds: string[];
  onSelectProduct: (product: Product) => void;
  onNavigateHome: () => void;
}

/**
 * Formats ISO date string to readable format e.g. "Jan 2024"
 */
export function formatStoreDate(dateStr?: string | null): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return 'Recently';
  }
}

/**
 * Header rating copy. Null-safe: a seller with no approved reviews or no cached
 * rating never renders `NaN` or `0.0`.
 */
function formatSellerRating(rating: number | null, reviewCount: number | null): string {
  const count = typeof reviewCount === 'number' && Number.isFinite(reviewCount) && reviewCount > 0
    ? Math.floor(reviewCount)
    : 0;

  if (rating === null || !Number.isFinite(rating) || count === 0) {
    return 'No reviews yet';
  }

  const clamped = Math.min(Math.max(rating, 0), 5);
  return `${clamped.toFixed(1)} / 5.0 (${count} ${count === 1 ? 'Review' : 'Reviews'})`;
}

/**
 * Maps one storefront row to the existing card model. Everything the card shows
 * (thumbnail, title, price, rating) arrives in the same response, so a card is
 * never blocked by a missing field.
 */
function mapProductToCard(
  product: StorefrontProduct,
  variantPrices?: Record<string, { min: number; max: number }>
): Product {
  // Fill a broken variant cache with the fallback prices, when they exist.
  const fallback = variantPrices?.[product.id];
  const priced: StorefrontProduct = fallback
    ? {
        ...product,
        cached_min_variant_price: fallback.min,
        cached_max_variant_price: fallback.max,
      }
    : product;

  const price = resolveProductPrice(priced);
  const rating = summarizeRatings(product.reviews);
  const image = pickThumbnailUrl(product.product_images) || STOREFRONT_PLACEHOLDER_IMAGE;

  const card: Product = {
    id: product.id,
    title: (product.title || '').trim() || 'Untitled Listing',
    brand: '',
    category: '',
    currency: 'PKR',
    // 0 is rendered as "—" by the card; it also covers `pending` variant prices.
    price: 0,
    image,
  };

  if (price.kind === 'single') {
    card.price = price.price;
    card.surplus_selling_price = price.price;
    card.original_retail_price = price.price;
    card.originalPrice = price.price;
  } else if (price.kind === 'sale') {
    card.price = price.price;
    card.surplus_selling_price = price.price;
    card.original_retail_price = price.original;
    card.originalPrice = price.original;
    if (price.original > 0) {
      card.discountPercentage = Math.round(((price.original - price.price) / price.original) * 100);
    }
  } else if (price.kind === 'range') {
    // The card has a single price slot, so a range shows its minimum without a
    // misleading "was" price or discount badge.
    card.price = price.min;
    card.surplus_selling_price = price.min;
    card.original_retail_price = price.min;
    card.originalPrice = price.min;
  }

  // Approved reviews win; otherwise fall back to the cached rating columns that the
  // cards used before, so the footer star is never blank on the storefront.
  const approvedRating = rating.average !== null && rating.count > 0 ? rating.average : null;
  const storedRating =
    product.average_rating === null || product.average_rating === undefined
      ? null
      : Number(product.average_rating);
  const storedCount =
    product.review_count === null || product.review_count === undefined ? 0 : Number(product.review_count);

  const cardRating = approvedRating ?? (storedRating !== null && Number.isFinite(storedRating) ? storedRating : null);
  if (cardRating !== null) {
    card.average_rating = cardRating;
    card.review_count = Number.isFinite(storedCount) ? Math.max(0, Math.floor(storedCount)) : 0;
  }

  return card;
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

/** Grid of card skeletons sized exactly like real cards (no layout shift). */
const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = STOREFRONT_PAGE_SIZE }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6" aria-busy="true">
    {Array.from({ length: count }).map((_, idx) => (
      <ProductCardSkeleton key={idx} />
    ))}
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
}) => {
  // Decoded and normalized once; every query key below carries it.
  const shop = normalizeShopIdentifier(resellerId);

  // -------- Request A: seller (drives the header only) --------
  const sellerQuery = useQuery({
    ...STOREFRONT_QUERY_OPTIONS,
    queryKey: ['storefront', shop, 'seller'],
    queryFn: () => fetchSeller(shop),
    enabled: Boolean(shop),
  });

  const seller = sellerQuery.data ?? null;
  const sellerId = seller?.id ?? null;
  // A seller that is pending/suspended/inactive has no public storefront.
  const sellerIsAvailable = seller !== null && isActiveSellerStatus(seller.status);

  // -------- Request C: category chips (drives the chips bar only) --------
  const categoriesQuery = useQuery({
    ...STOREFRONT_QUERY_OPTIONS,
    queryKey: ['storefront', shop, 'categories'],
    queryFn: () => fetchSellerCategories(sellerId as string),
    enabled: Boolean(shop) && sellerIsAvailable,
  });

  // Chip selection + applied (committed) filters + draft (drawer) filters
  const [typeChip, setTypeChip] = useState<string>('All');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [appliedFilters, setAppliedFilters] = useState<ResellerStorefrontFilterState>({
    sort: '',
    department: '',
  });
  const [draftFilters, setDraftFilters] = useState<ResellerStorefrontFilterState>({
    sort: '',
    department: '',
  });

  // Chips are per name; each chip filters by every category id sharing that name.
  const categoryGroups = useMemo(() => groupCategoriesByName(categoriesQuery.data), [categoriesQuery.data]);

  const selectedCategoryIds = useMemo(() => {
    if (typeChip.trim().toLowerCase() === 'all') return null;
    const group = categoryGroups.find((item) => item.name.toLowerCase() === typeChip.toLowerCase());
    return group ? group.ids : [];
  }, [typeChip, categoryGroups]);

  // Part of the query key so the cache never serves another chip's page.
  const selectedCategoryKey = selectedCategoryIds ? selectedCategoryIds.join(',') : 'all';

  // -------- Request B: products page (drives the grid only) --------
  const productsQuery = useInfiniteQuery({
    ...STOREFRONT_QUERY_OPTIONS,
    queryKey: ['storefront', shop, 'products', typeChip, appliedFilters.sort, selectedCategoryKey],
    queryFn: ({ pageParam }) =>
      fetchSellerProducts({
        sellerId: sellerId as string,
        page: Number(pageParam) || 1,
        sort: appliedFilters.sort,
        categoryIds: selectedCategoryIds,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * STOREFRONT_PAGE_SIZE;
      if (loadedCount < lastPage.count && lastPage.products.length === STOREFRONT_PAGE_SIZE) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: Boolean(shop) && sellerIsAvailable,
  });

  const products = useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.products) ?? [],
    [productsQuery.data]
  );

  // Rare fallback: only variant products whose cached min/max are null are re-priced.
  const pendingVariantIds = useMemo(() => collectPendingVariantIds(products), [products]);

  const variantPricesQuery = useQuery({
    ...STOREFRONT_QUERY_OPTIONS,
    queryKey: ['storefront', shop, 'variant-prices', pendingVariantIds],
    queryFn: () => fetchVariantPrices(pendingVariantIds),
    enabled: pendingVariantIds.length > 0,
  });

  const cards = useMemo(
    () => products.map((product) => mapProductToCard(product, variantPricesQuery.data)),
    [products, variantPricesQuery.data]
  );

  // Sentinel ref for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, isLoading: isProductsLoading, fetchNextPage } = productsQuery;

  // Infinite Scroll IntersectionObserver: triggers fetchNextPage() automatically on scroll down
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && !isProductsLoading) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '350px' }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [hasNextPage, isFetchingNextPage, isProductsLoading, fetchNextPage]);

  const chipNames = useMemo(
    () => ['All', ...categoryGroups.map((group) => group.name)],
    [categoryGroups]
  );

  // Handle Category Chip Click (resets the products query back to page 1)
  const handleSelectCategory = (chip: string) => {
    if (chip.toLowerCase() === typeChip.toLowerCase()) return;
    setTypeChip(chip);
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
    setDraftFilters({ sort: '', department: '' });
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setIsFilterOpen(false);
  };

  const handleClearAllFilters = () => {
    setTypeChip('All');
    setAppliedFilters({ sort: '', department: '' });
    setDraftFilters({ sort: '', department: '' });
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
          setIsFilterOpen(false);
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
    if (typeof window !== 'undefined' && seller?.shop_name) {
      const cleanSlug = formatStoreSlug(seller.shop_name);
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

  const isResolvingSeller = sellerQuery.isLoading;
  const sellerIsUnavailable = !isResolvingSeller && (sellerQuery.isError || !sellerIsAvailable);

  // Store unavailable / not found: one neutral page, no reason leaked.
  if (sellerIsUnavailable) {
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
          <h3 className="text-lg font-bold text-stone-900">Store unavailable</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            This store is not available right now. Please check the URL or try again later.
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

  // Header values (all null-safe)
  const sellerShopName = seller?.shop_name?.trim() || 'Seller';
  const sellerStoreImage = seller?.store_image_url || STOREFRONT_STORE_LOGO;
  const sellerJoinedDate = formatStoreDate(seller?.created_at);
  const sellerRatingText = formatSellerRating(seller?.average_rating ?? null, seller?.review_count ?? null);

  const hasActiveFilters = typeChip.trim().toLowerCase() !== 'all' || appliedFilters.sort !== '';
  const firstPageCount = productsQuery.data?.pages?.[0]?.count ?? 0;
  // Seller has nothing on sale at all (drives the "No products yet" state)
  const sellerHasNoProducts =
    sellerIsAvailable && !hasActiveFilters && !productsQuery.isLoading && !productsQuery.isError && firstPageCount === 0;
  const showChipsRow = sellerIsAvailable && !sellerHasNoProducts;

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20">
      {/* Profile Header Hero Block — renders as soon as Request A resolves */}
      {isResolvingSeller || !seller ? (
        <SellerHeaderSkeleton />
      ) : (
        <div className="relative bg-stone-900 text-white overflow-hidden">
          {/* Banner Image */}
          <div className="absolute inset-0 opacity-40 mix-blend-overlay">
            <img src={STOREFRONT_BANNER_IMAGE} alt={sellerShopName} className="w-full h-full object-cover" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
            {/* ================= MOBILE LAYOUT ================= */}
            <div className="md:hidden">
              <div className="flex items-center gap-3">
                {/* Logo */}
                <div className="relative w-20 h-20 rounded-full border-2 border-white overflow-hidden bg-stone-800 shrink-0 shadow-xl">
                  <img
                    src={sellerStoreImage}
                    alt={sellerShopName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = STOREFRONT_STORE_LOGO;
                    }}
                  />
                </div>

                {/* Verified + Store Name */}
                <div className="min-w-0 flex flex-col items-start gap-1.5">
                  <span className="bg-amber-400 text-stone-950 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-xs">
                    VERIFIED SELLER
                  </span>

                  <h1 className="text-xl sm:text-2xl font-brand-serif font-normal tracking-wide truncate max-w-full">
                    {sellerShopName}
                  </h1>
                </div>
              </div>

              {/* Description */}
              <p className="mt-3 text-xs text-stone-300 leading-relaxed">{STOREFRONT_DESCRIPTION}</p>

              {/* Mobile Stats */}
              <div className="mt-4 -mx-4 px-4 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-5 w-max whitespace-nowrap text-[10px]">
                  {/* Rating */}
                  <div className="flex items-center gap-1 text-amber-400 font-bold shrink-0">
                    <Star className="w-3.5 h-3.5 fill-amber-400 shrink-0" />
                    <span>{sellerRatingText}</span>
                  </div>

                  {/* Member Since */}
                  <div className="flex items-center gap-1 text-stone-300 shrink-0">
                    <Calendar className="w-3 h-3 text-stone-400 shrink-0" />
                    <span>Member Since: {sellerJoinedDate}</span>
                  </div>

                  {/* Total Sales */}
                  <div className="flex items-center gap-1 text-stone-300 font-semibold shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>0+ Suits Sold</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= TABLET + DESKTOP LAYOUT ================= */}
            <div className="hidden md:flex flex-row items-center gap-6">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white overflow-hidden bg-stone-800 shrink-0 shadow-xl">
                <img
                  src={sellerStoreImage}
                  alt={sellerShopName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = STOREFRONT_STORE_LOGO;
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
                  {sellerShopName}
                </h1>

                <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
                  {STOREFRONT_DESCRIPTION}
                </p>

                {/* Badges Row */}
                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                  <div className="flex items-center space-x-1 text-amber-400 font-bold">
                    <Star className="w-4 h-4 fill-amber-400" />
                    <span>{sellerRatingText}</span>
                  </div>

                  <div className="flex items-center space-x-1 text-stone-300">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>Member Since: {sellerJoinedDate}</span>
                  </div>

                  <div className="flex items-center space-x-1 text-stone-300 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>0+ Suits Sold</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8" aria-busy={isProductsLoading}>
        {/* Categories bar — independent of the grid */}
        {!sellerIsAvailable ? (
          <ChipRowSkeleton />
        ) : showChipsRow ? (
          categoriesQuery.isLoading ? (
            <ChipRowSkeleton />
          ) : (
              <div className="flex items-center gap-2 mb-6">
                <div className="flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                  <div className="flex w-max gap-2 py-1">
                    {categoriesQuery.isError && (
                      <button
                        type="button"
                        onClick={() => categoriesQuery.refetch()}
                        className="h-10 px-3 rounded-[10px] border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Categories unavailable</span>
                        <span className="underline">Retry</span>
                      </button>
                    )}

                    {chipNames.map((chip) => {
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
                {/* <button
                  type="button"
                  ref={filterButtonRef}
                  onClick={handleOpenFilter}
                  className="shrink-0 h-10 w-10 rounded-[10px] border border-stone-200 bg-white text-stone-700 hover:text-stone-900 hover:border-stone-400 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                  aria-label="Open filters"
                  aria-haspopup="dialog"
                  aria-expanded={isFilterOpen}
                >
                  <Filter className="w-4 h-4" />
                </button> */}
              </div>
          )
        ) : null}

        {/* Product grid — independent of the header and the chips */}
        {!sellerIsAvailable ? (
          <>
            <span className="sr-only" role="status">
              Loading products
            </span>
            <ProductGridSkeleton />
          </>
        ) : sellerHasNoProducts ? (
          <div className="py-16 text-center bg-white rounded-lg border border-stone-200 p-8 max-w-md mx-auto space-y-2">
            <p className="text-sm font-bold text-stone-800">No products yet</p>
            <p className="text-xs text-stone-500">This reseller currently has no active surplus listings available.</p>
          </div>
        ) : isProductsLoading ? (
          /* 1. Skeletons only on the first load of a query key (never on refetch) */
          <>
            <span className="sr-only" role="status">
              Loading products
            </span>
            <ProductGridSkeleton />
          </>
        ) : productsQuery.isError ? (
          /* 2. Grid error with Retry; header and chips stay visible */
          <div className="py-16 text-center bg-white rounded-lg border border-stone-200 p-8 max-w-md mx-auto space-y-4">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm font-bold text-stone-800">Failed to load products</p>
            <p className="text-xs text-stone-500">Please check your internet connection and try again.</p>
            <button
              type="button"
              onClick={() => productsQuery.refetch()}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-bold uppercase tracking-wider rounded-xs hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : cards.length === 0 ? (
          /* 3. Empty state: only when the query succeeded and returned 0 products */
          <div className="py-16 text-center bg-white rounded-lg border border-stone-200 p-8 max-w-md mx-auto space-y-4">
            <p className="text-sm font-bold text-stone-800">No products match your filters</p>
            <p className="text-xs text-stone-500">Try adjusting your filters or category selection.</p>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-bold uppercase tracking-wider rounded-xs hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          /* 4. Product grid with smooth infinite scroll */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {cards.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 4}
                  titleVariant="brand"
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
                <ProductGridSkeleton count={4} />
                <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-stone-600">
                  <Loader2 className="w-4 h-4 animate-spin text-stone-900" />
                  <span>Loading more suits...</span>
                </div>
              </div>
            )}

            {/* End of results message */}
            {!hasNextPage && cards.length > STOREFRONT_PAGE_SIZE && (
              <div className="py-10 text-center">
                <p className="text-xs text-stone-400 font-medium">
                  You've reached the end • Showing all {cards.length} products
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Sidebar (Portal to document.body with Apply pattern) */}
      {mounted &&
        showChipsRow &&
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
                  {(draftFilters.sort || draftFilters.department) && (
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
