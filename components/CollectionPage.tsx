import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SlidersHorizontal, Grid3X3, LayoutGrid, Grid2X2, ChevronRight, X, ArrowUpDown, Filter, Grid3x2, Loader2 } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { FiltersDrawer } from './FiltersDrawer';
import { ALL_PRODUCTS, BRANDS } from '@/data/mockData';
import { Product, FilterOptions } from '@/types';
import { fetchCollectionProducts } from '@/src/api/collectionService';

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
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(3);
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'newest' | 'best-discount' | 'most-popular'>('featured');

  // Supabase Paginated Products & Infinite Scroll State
  const [supabaseProducts, setSupabaseProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const isFetchingRef = useRef(false);

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

  const seenProductIdsRef = useRef<Set<string>>(new Set());

  // Load products from Supabase in batches of 10 for the MVP Feed
  const loadProducts = async (pageToFetch: number, isReset: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isReset) {
      setLoading(true);
      seenProductIdsRef.current.clear();
    } else {
      setLoadingMore(true);
    }

    try {
      const excludedIds = Array.from(seenProductIdsRef.current);
      const res = await fetchCollectionProducts({
        categoryTitle,
        brandFilter,
        filters,
        page: pageToFetch,
        pageSize: 10,
        excludedIds,
      });

      res.products.forEach((p) => seenProductIdsRef.current.add(p.id));

      setSupabaseProducts((prev) => {
        if (isReset) return res.products;
        const existingIds = new Set(prev.map((p) => p.id));
        const newProducts = res.products.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newProducts];
      });

      setHasMore(res.hasMore);
      setPage(pageToFetch);
    } catch (err) {
      console.error('Error loading paginated MVP feed products:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  };

  // Reset & load page 0 whenever category, brandFilter, or active filters change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    seenProductIdsRef.current.clear();
    setSupabaseProducts([]);
    loadProducts(0, true);
  }, [categoryTitle, brandFilter, filters]);

  // Infinite Scroll Listener
  useEffect(() => {
    const handleScroll = () => {
      if (loading || loadingMore || !hasMore || isFetchingRef.current) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 600;

      if (scrollPosition >= threshold) {
        loadProducts(page + 1, false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore, page, categoryTitle, brandFilter, filters]);

  // Filter and Sort logic
  const filteredProducts = useMemo(() => {
    const sourceProducts = supabaseProducts.length > 0 ? supabaseProducts : (productsList || []);

    return sourceProducts
      .filter((product) => {
        // Hide deactivated products
        if (product.listingStatus === 'Deactivated') return false;

        // Brand Filter
        if (filters.brands && filters.brands.length > 0) {
          if (!product.brand || !filters.brands.includes(product.brand)) {
            return false;
          }
        }

        // Stitching Status
        if (filters.stitchingStatuses && filters.stitchingStatuses.length > 0) {
          if (!product.stitchingStatus || !filters.stitchingStatuses.includes(product.stitchingStatus)) {
            return false;
          }
        }

        // Piece Count
        if (filters.pieceCounts && filters.pieceCounts.length > 0) {
          if (!product.pieceCount || !filters.pieceCounts.includes(product.pieceCount)) {
            return false;
          }
        }

        // Fabric Filter
        if (filters.fabrics && filters.fabrics.length > 0) {
          if (!product.fabric) return false;
          const matchesFab = filters.fabrics.some((f) =>
            product.fabric?.toLowerCase().includes(f.toLowerCase())
          );
          if (!matchesFab) return false;
        }

        // Color Filter
        if (filters.colors && filters.colors.length > 0) {
          if (!product.color) return false;
          const matchesCol = filters.colors.some((c) =>
            product.color?.toLowerCase().includes(c.toLowerCase())
          );
          if (!matchesCol) return false;
        }

        // Occasion Filter
        if (filters.occasions && filters.occasions.length > 0) {
          if (!product.occasion || !filters.occasions.includes(product.occasion)) {
            return false;
          }
        }

        // Size Filter
        if (filters.sizes && filters.sizes.length > 0) {
          if (!product.size || !filters.sizes.includes(product.size)) {
            return false;
          }
        }

        // Discount Ranges Filter ('10-30%', '30-50%', '50%+')
        if (filters.discountRanges && filters.discountRanges.length > 0) {
          const disc = product.discountPercentage || 0;
          const matchesDisc = filters.discountRanges.some((range) => {
            if (range === '10-30%') return disc >= 10 && disc <= 30;
            if (range === '30-50%') return disc > 30 && disc <= 50;
            if (range === '50%+') return disc > 50;
            return true;
          });
          if (!matchesDisc) return false;
        }

        // Reseller Rating
        if (filters.minResellerRating && filters.minResellerRating > 0) {
          if ((product.resellerRating || 0) < filters.minResellerRating) {
            return false;
          }
        }

        // Price Range Filter
        if (filters.priceRange && (product.price < filters.priceRange[0] || product.price > filters.priceRange[1])) {
          return false;
        }

        // In Stock Filter
        if (filters.inStockOnly && !product.inStock) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        if (sortBy === 'best-discount') return (b.discountPercentage || 0) - (a.discountPercentage || 0);
        if (sortBy === 'most-popular') return (b.resellerRating || 0) - (a.resellerRating || 0);
        return 0; // Default newest-first from Supabase created_at DESC query
      });
  }, [supabaseProducts, productsList, filters, sortBy]);

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
        <div className="bg-white border border-stone-200 rounded-lg p-3 sm:p-4 mb-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          {/* Left: Filter Toggle Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsFiltersOpen(true)}
              className="flex items-center space-x-2 bg-stone-900 hover:bg-black text-white px-4 py-2 rounded-xs text-xs font-bold uppercase tracking-wider shadow-sm transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>FILTERS</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-extrabold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <span className="text-xs text-stone-500 font-medium hidden sm:inline">
              Showing <strong className="text-stone-900">{filteredProducts.length}</strong> items
            </span>
          </div>

          {/* Right: Grid Layout & Sort Dropdown */}
          <div className="flex items-center space-x-4">
            {/* Grid Columns Switcher (Desktop) */}
            <div className="hidden md:flex items-center space-x-1 border-r border-stone-200 pr-4">
              <button
                onClick={() => setGridCols(2)}
                className={`p-1.5 rounded-xs transition-colors ${gridCols === 2 ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-700'
                  }`}
                title="2 Columns"
              >
                <Grid2X2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridCols(3)}
                className={`p-1.5 rounded-xs transition-colors ${gridCols === 3 ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-700'
                  }`}
                title="3 Columns"
              >
                <Grid3x2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridCols(4)}
                className={`p-1.5 rounded-xs transition-colors ${gridCols === 4 ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-700'
                  }`}
                title="4 Columns"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-stone-50 border border-stone-200 text-stone-800 text-xs font-semibold rounded-xs py-1.5 px-2.5 focus:outline-none focus:border-stone-900 cursor-pointer"
              >
                <option value="featured">Sort: Featured</option>
                <option value="newest">Sort: Newest First</option>
                <option value="price-low">Sort: Price (Low to High)</option>
                <option value="price-high">Sort: Price (High to Low)</option>
                <option value="best-discount">Sort: Best Discount</option>
                <option value="most-popular">Sort: Reseller Rating</option>
              </select>
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
        {loading && supabaseProducts.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-lg p-16 text-center my-8 shadow-2xs">
            <Loader2 className="w-8 h-8 animate-spin text-stone-800 mx-auto mb-3" />
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Loading Leftover Suits...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
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
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={onQuickView}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  isWishlisted={wishlistIds.includes(product.id)}
                  onSelectProduct={onSelectProduct}
                  onSelectReseller={onSelectReseller}
                />
              ))}
            </div>

            {/* Infinite Scroll Bottom Loading Spinner */}
            {loadingMore && (
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
        totalResultsCount={filteredProducts.length}
      />
    </div>
  );
};
