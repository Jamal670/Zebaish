import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SlidersHorizontal, Grid3X3, LayoutGrid, Grid2X2, ChevronRight, X, ArrowUpDown, Filter, Grid3x2, Loader2 } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { FiltersDrawer } from './FiltersDrawer';
import { ALL_PRODUCTS, BRANDS } from '@/data/mockData';
import { Product, FilterOptions } from '@/types';
import { fetchCollectionProducts } from '@/src/api/collectionService';
import { useCollectionProductsQuery } from '@/src/hooks/useQueries';

interface CollectionPageProps {
  categoryTitle?: string;
  brandFilter?: string;
  productsList?: Product[];
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  wishlistIds: string[];
  onSelectProduct: (product: Product) => void;
  onSelectReseller?: (resellerId: string) => void;
  onNavigateHome: () => void;
  onSelectBrand?: (brand: string) => void;
}

export const CollectionPage: React.FC<CollectionPageProps> = ({
  categoryTitle = 'ALL LEFTOVER SUITS',
  brandFilter,
  productsList,
  onQuickView,
  onAddToCart,
  onToggleWishlist,
  wishlistIds,
  onSelectProduct,
  onSelectReseller,
  onNavigateHome,
  onSelectBrand,
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(4);
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'newest' | 'best-discount' | 'most-popular'>('featured');

  // Supabase Paginated Products & Infinite Scroll State
  const [accumulatedProducts, setAccumulatedProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(0);

  const [filters, setFilters] = useState<FilterOptions>({
    brands: brandFilter ? [brandFilter] : [],
    stitchingStatuses: [],
    pieceCounts: [],
    fabrics: [],
    colors: [],
    occasions: [],
    sizes: [],
    priceRange: [0, 100000],
    discountRanges: [],
    minResellerRating: 0,
    inStockOnly: false,
    categories: [],
  });

  // Keep brandFilter synced if prop changes
  useEffect(() => {
    if (brandFilter) {
      setFilters((prev) => ({
        ...prev,
        brands: [brandFilter],
      }));
    }
  }, [brandFilter]);

  const queryParams = useMemo(() => ({
    categoryTitle,
    brandFilter,
    filters,
    sortBy,
    page,
    pageSize: 12,
  }), [categoryTitle, brandFilter, filters, sortBy, page]);

  // TanStack Query with staleTime: 3 * 60 * 1000 (3 minutes)
  const { data: queryResult, isLoading, isFetching } = useCollectionProductsQuery(queryParams);

  // Sync query data into accumulatedProducts for continuous infinite scroll pagination
  useEffect(() => {
    if (queryResult?.products) {
      if (page === 0) {
        setAccumulatedProducts(queryResult.products);
      } else {
        setAccumulatedProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newProducts = queryResult.products.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newProducts];
        });
      }
    }
  }, [queryResult, page]);

  // Reset page to 0 when filter/sort options change
  useEffect(() => {
    setPage(0);
    setAccumulatedProducts([]);
  }, [categoryTitle, brandFilter, filters, sortBy]);

  const hasMore = queryResult?.hasMore ?? true;
  const totalCount = queryResult?.totalCount ?? accumulatedProducts.length;

  // Infinite Scroll Listener
  useEffect(() => {
    const handleScroll = () => {
      if (isLoading || isFetching || !hasMore) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 600;

      if (scrollPosition >= threshold) {
        setPage((prevPage) => prevPage + 1);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, isFetching, hasMore]);

  // Memoize wishlistSet for O(1) instant lookup inside grid renders
  const wishlistSet = useMemo(() => new Set(wishlistIds), [wishlistIds]);

  // Products to display: prioritizes accumulated scroll products, falls back to direct TanStack query cache (e.g. on back navigation), then productsList prop
  const displayProducts = useMemo(() => {
    if (accumulatedProducts.length > 0) return accumulatedProducts;
    if (queryResult?.products && queryResult.products.length > 0) return queryResult.products;
    return productsList || [];
  }, [accumulatedProducts, queryResult?.products, productsList]);

  const activeFilterCount =
    (filters.brands?.length || 0) +
    (filters.stitchingStatuses?.length || 0) +
    (filters.pieceCounts?.length || 0) +
    (filters.fabrics?.length || 0) +
    (filters.colors?.length || 0) +
    (filters.occasions?.length || 0) +
    (filters.sizes?.length || 0) +
    (filters.discountRanges?.length || 0) +
    (filters.minResellerRating > 0 ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.priceRange && (filters.priceRange[1] < 100000 || filters.priceRange[0] > 0) ? 1 : 0);

  const removeFilterChip = (key: keyof FilterOptions, val?: string) => {
    setFilters((prev) => {
      if (Array.isArray(prev[key]) && val) {
        const arr = (prev[key] as string[]).filter((item) => item !== val);
        return { ...prev, [key]: arr };
      }
      if (key === 'inStockOnly') return { ...prev, inStockOnly: false };
      if (key === 'minResellerRating') return { ...prev, minResellerRating: 0 };
      if (key === 'priceRange') return { ...prev, priceRange: [0, 100000] };
      return prev;
    });
  };

  const displayTitle = brandFilter ? `${brandFilter.toUpperCase()} LEFTOVER STOCK` : categoryTitle;

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-white border-b border-stone-200 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          {/* <nav className="flex items-center space-x-2 text-xs text-stone-500 mb-3 uppercase tracking-wider font-medium">
            <button
              onClick={onNavigateHome}
              className="hover:text-stone-900 transition-colors"
            >
              Home
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-900 font-bold">{brandFilter ? 'Brands' : 'Catalog'}</span>
            {brandFilter && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-stone-900 font-bold">{brandFilter}</span>
              </>
            )}
          </nav> */}

          <div className="ml-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-brand-serif font-semibold text-stone-900 tracking-wider uppercase">
                {displayTitle}
              </h1>
              <p className="text-xs text-stone-500 mt-1">
                Authentic factory surplus & end-of-season designer suits from verified resellers across Pakistan
              </p>
            </div>

            {/* Quick Brand Pills Row */}
            {/* <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-xl no-scrollbar">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mr-1 shrink-0">
                Brands:
              </span>
              <button
                onClick={() => {
                  if (onSelectBrand) onSelectBrand('');
                  setFilters((prev) => ({ ...prev, brands: [] }));
                }}
                className={`text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0 transition-colors ${
                  !brandFilter && filters.brands.length === 0
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                All
              </button>
              {BRANDS.slice(0, 8).map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    if (onSelectBrand) onSelectBrand(b);
                    setFilters((prev) => ({ ...prev, brands: [b] }));
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0 transition-colors ${
                    brandFilter === b || filters.brands.includes(b)
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div> */}
          </div>
        </div>
      </div>

      {/* Toolbar & Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Toolbar */}
        <div className="bg-white border border-stone-200 rounded-lg p-2.5 sm:p-3.5 lg:p-4 mb-6 shadow-2xs">
          <div className="flex items-center justify-between gap-2 sm:gap-4">

            {/* LEFT: Filter + Item Count */}
            <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 min-w-0">

              <button
                onClick={() => setIsFiltersOpen(true)}
                className="
          flex items-center justify-center
          gap-1
          sm:gap-1.5
          lg:gap-2

          w-[78px]
          h-[32px]
          sm:w-[100px]
          sm:h-[36px]
          lg:w-[115px]
          lg:h-[40px]

          bg-stone-900
          hover:bg-black
          text-white

          rounded-xs

          text-[9px]
          sm:text-[10px]
          lg:text-xs

          font-bold
          uppercase
          tracking-wide
          sm:tracking-wider

          shadow-sm
          transition-colors

          whitespace-nowrap
          shrink-0
        "
              >
                <SlidersHorizontal
                  className="
            w-3
            h-3
            sm:w-3.5
            sm:h-3.5
            lg:w-4
            lg:h-4
            shrink-0
          "
                />

                <span>FILTERS</span>

                {activeFilterCount > 0 && (
                  <span
                    className="
              ml-0.5

              bg-red-600
              text-white

              text-[8px]
              sm:text-[9px]
              lg:text-[10px]

              w-3.5
              h-3.5
              sm:w-4
              sm:h-4
              lg:w-4
              lg:h-4

              rounded-full
              flex
              items-center
              justify-center

              font-extrabold
              shrink-0
            "
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Item Count */}
              <span
                className="
          hidden sm:inline

          text-[10px]
          sm:text-xs
          lg:text-sm

          text-stone-500
          font-medium
          whitespace-nowrap
        "
              >
                Showing{" "}
                <strong className="text-stone-900">
                  {totalCount || displayProducts.length}
                </strong>{" "}
                items
              </span>
            </div>

            {/* RIGHT: Grid + Sort */}
            <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 shrink-0">

              {/* Grid Columns Switcher */}
              <div
                className="
          hidden md:flex
          items-center
          space-x-0.5
          lg:space-x-1

          border-r
          border-stone-200

          pr-2
          lg:pr-4
        "
              >
                <button
                  onClick={() => setGridCols(2)}
                  className={`
            p-1
            lg:p-1.5
            rounded-xs
            transition-colors
            ${gridCols === 2
                      ? "bg-stone-900 text-white"
                      : "text-stone-400 hover:text-stone-700"
                    }
          `}
                  title="2 Columns"
                >
                  <Grid2X2
                    className="
              w-3
              h-3
              lg:w-4
              lg:h-4
            "
                  />
                </button>

                <button
                  onClick={() => setGridCols(3)}
                  className={`
            p-1
            lg:p-1.5
            rounded-xs
            transition-colors
            ${gridCols === 3
                      ? "bg-stone-900 text-white"
                      : "text-stone-400 hover:text-stone-700"
                    }
          `}
                  title="3 Columns"
                >
                  <Grid3x2
                    className="
              w-3
              h-3
              lg:w-4
              lg:h-4
            "
                  />
                </button>

                <button
                  onClick={() => setGridCols(4)}
                  className={`
            p-1
            lg:p-1.5
            rounded-xs
            transition-colors
            ${gridCols === 4
                      ? "bg-stone-900 text-white"
                      : "text-stone-400 hover:text-stone-700"
                    }
          `}
                  title="4 Columns"
                >
                  <Grid3X3
                    className="
              w-3
              h-3
              lg:w-4
              lg:h-4
            "
                  />
                </button>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 shrink-0">

                <ArrowUpDown
                  className="
            w-3
            h-3
            sm:w-3.5
            sm:h-3.5
            lg:w-4
            lg:h-4

            text-stone-400
            shrink-0
          "
                />

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="
            bg-stone-50
            border border-stone-200

            text-stone-800

            text-[9px]
            sm:text-[10px]
            lg:text-xs

            font-semibold

            rounded-xs

            w-[115px]
            h-[32px]

            sm:w-[150px]
            sm:h-[36px]

            lg:w-[175px]
            lg:h-[40px]

            px-1.5
            sm:px-2
            lg:px-2.5

            focus:outline-none
            focus:border-stone-900

            cursor-pointer

            whitespace-nowrap
            shrink-0
          "
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="newest">Sort: Newest First</option>
                  <option value="price-low">
                    Sort: Price (Low to High)
                  </option>
                  <option value="price-high">
                    Sort: Price (High to Low)
                  </option>
                  <option value="best-discount">
                    Sort: Best Discount
                  </option>
                  <option value="most-popular">
                    Sort: Reseller Rating
                  </option>
                </select>

              </div>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider mr-1">
              Active Filters:
            </span>
            {filters.brands.map((b) => (
              <span
                key={b}
                className="inline-flex items-center space-x-1.5 bg-stone-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-2xs"
              >
                <span>Brand: {b}</span>
                <button
                  onClick={() => removeFilterChip('brands', b)}
                  className="hover:text-stone-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.stitchingStatuses.map((s) => (
              <span
                key={s}
                className="inline-flex items-center space-x-1.5 bg-stone-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full"
              >
                <span>{s}</span>
                <button
                  onClick={() => removeFilterChip('stitchingStatuses', s)}
                  className="hover:text-stone-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.fabrics.map((f) => (
              <span
                key={f}
                className="inline-flex items-center space-x-1.5 bg-stone-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full"
              >
                <span>Fabric: {f}</span>
                <button
                  onClick={() => removeFilterChip('fabrics', f)}
                  className="hover:text-stone-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.colors.map((c) => (
              <span
                key={c}
                className="inline-flex items-center space-x-1.5 bg-stone-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full"
              >
                <span>Color: {c}</span>
                <button
                  onClick={() => removeFilterChip('colors', c)}
                  className="hover:text-stone-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.discountRanges.map((d) => (
              <span
                key={d}
                className="inline-flex items-center space-x-1.5 bg-red-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full"
              >
                <span>Discount: {d}</span>
                <button
                  onClick={() => removeFilterChip('discountRanges', d)}
                  className="hover:text-stone-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() =>
                setFilters({
                  brands: [],
                  stitchingStatuses: [],
                  pieceCounts: [],
                  fabrics: [],
                  colors: [],
                  occasions: [],
                  sizes: [],
                  priceRange: [0, 1500],
                  discountRanges: [],
                  minResellerRating: 0,
                  inStockOnly: false,
                  categories: [],
                })
              }
              className="text-xs font-bold text-stone-600 underline hover:text-stone-900 ml-2"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Initial Loading State */}
        {isLoading && displayProducts.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-lg p-16 text-center my-8 shadow-2xs">
            <Loader2 className="w-8 h-8 animate-spin text-stone-800 mx-auto mb-3" />
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Loading Leftover Suits...
            </p>
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-lg p-12 text-center my-8">
            <Filter className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-stone-900 uppercase tracking-wider">
              No products found in this category
            </h3>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
              Try broadening your selection or clear brand / price filters to view all available factory leftover stock.
            </p>
            <button
              onClick={() =>
                setFilters({
                  brands: [],
                  stitchingStatuses: [],
                  pieceCounts: [],
                  fabrics: [],
                  colors: [],
                  occasions: [],
                  sizes: [],
                  priceRange: [0, 100000],
                  discountRanges: [],
                  minResellerRating: 0,
                  inStockOnly: false,
                  categories: [],
                })
              }
              className="mt-4 inline-block bg-stone-900 text-white text-xs font-bold px-5 py-2.5 rounded-xs uppercase tracking-wider hover:bg-black transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <>
            <div
              className={`grid gap-4 sm:gap-6 ${gridCols === 2
                ? 'grid-cols-2'
                : gridCols === 3
                  ? 'grid-cols-2 md:grid-cols-3'
                  : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                }`}
            >
              {displayProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={onQuickView}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  isWishlisted={wishlistSet.has(product.id)}
                  onSelectProduct={onSelectProduct}
                  onSelectReseller={onSelectReseller}
                />
              ))}
            </div>

            {/* Infinite Scroll Bottom Loading Spinner */}
            {isFetching && page > 0 && (
              <div className="py-10 text-center flex items-center justify-center space-x-2 text-stone-600">
                <Loader2 className="w-5 h-5 animate-spin text-stone-800" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Loading More Suits...
                </span>
              </div>
            )}

            {/* {!hasMore && supabaseProducts.length > 0 && (
              <div className="py-8 text-center text-xs text-stone-400 font-medium uppercase tracking-wider">
                End of Collection
              </div>
            )} */}
          </>
        )}
      </div>

      {/* Filters Drawer */}
      <FiltersDrawer
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => setFilters(newFilters)}
        onClearFilters={() =>
          setFilters({
            brands: [],
            stitchingStatuses: [],
            pieceCounts: [],
            fabrics: [],
            colors: [],
            occasions: [],
            sizes: [],
            priceRange: [0, 100000],
            discountRanges: [],
            minResellerRating: 0,
            inStockOnly: false,
            categories: [],
          })
        }
        totalResultsCount={totalCount || displayProducts.length}
      />
    </div>
  );
};
