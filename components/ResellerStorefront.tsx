import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Star, MapPin, Clock, Calendar, CheckCircle2, MessageSquare, ArrowUpDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { Product, Review } from '@/types';
import { fetchSellerStorefrontData, fetchSellerReviewsPaginated, SellerStorefrontData } from '@/src/api/sellerService';

interface ResellerStorefrontProps {
  resellerId: string;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  wishlistIds: string[];
  onSelectProduct: (product: Product) => void;
  onNavigateHome: () => void;
}

export const ResellerStorefront: React.FC<ResellerStorefrontProps> = ({
  resellerId,
  onQuickView,
  onAddToCart,
  onToggleWishlist,
  wishlistIds,
  onSelectProduct,
  onNavigateHome,
}) => {
  const [storefrontData, setStorefrontData] = useState<SellerStorefrontData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'newest'>('featured');
  const [activeTab, setActiveTab] = useState<'listings' | 'reviews'>('listings');

  // Infinite Scroll Reviews State
  const [paginatedReviews, setPaginatedReviews] = useState<Review[]>([]);
  const [reviewsPage, setReviewsPage] = useState<number>(0);
  const [hasMoreReviews, setHasMoreReviews] = useState<boolean>(true);
  const [isLoadingReviews, setIsLoadingReviews] = useState<boolean>(false);
  const [isFetchingMoreReviews, setIsFetchingMoreReviews] = useState<boolean>(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [hasInitializedReviews, setHasInitializedReviews] = useState<boolean>(false);

  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    fetchSellerStorefrontData(resellerId)
      .then((data) => {
        setStorefrontData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching storefront data:', err);
        setError('Failed to load seller storefront. Please check your connection.');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadData();
    // Reset reviews state on resellerId change
    setHasInitializedReviews(false);
    setPaginatedReviews([]);
    setReviewsPage(0);
    setHasMoreReviews(true);
  }, [resellerId]);

  // Load initial 9 reviews for page 0
  const loadInitialReviews = useCallback(async () => {
    setIsLoadingReviews(true);
    setReviewsError(null);
    try {
      const res = await fetchSellerReviewsPaginated(resellerId, 0, 9);
      setPaginatedReviews(res.reviews);
      setReviewsPage(0);
      setHasMoreReviews(res.hasMore);
      setHasInitializedReviews(true);
    } catch (err: any) {
      console.error('Error loading initial reviews:', err);
      setReviewsError('Failed to load customer reviews.');
    } finally {
      setIsLoadingReviews(false);
    }
  }, [resellerId]);

  // Load next batch of 9 reviews on infinite scroll
  const loadNextReviewsPage = useCallback(async () => {
    if (!hasMoreReviews || isLoadingReviews || isFetchingMoreReviews || reviewsError) return;

    setIsFetchingMoreReviews(true);
    const nextPage = reviewsPage + 1;
    try {
      const res = await fetchSellerReviewsPaginated(resellerId, nextPage, 9);
      setPaginatedReviews((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const newItems = res.reviews.filter((r) => !existingIds.has(r.id));
        return [...prev, ...newItems];
      });
      setReviewsPage(nextPage);
      setHasMoreReviews(res.hasMore);
    } catch (err: any) {
      console.error('Error fetching next reviews page:', err);
    } finally {
      setIsFetchingMoreReviews(false);
    }
  }, [resellerId, reviewsPage, hasMoreReviews, isLoadingReviews, isFetchingMoreReviews, reviewsError]);

  // Trigger initial reviews fetch when Reviews tab is active
  useEffect(() => {
    if (activeTab === 'reviews' && !hasInitializedReviews) {
      loadInitialReviews();
    }
  }, [activeTab, hasInitializedReviews, loadInitialReviews]);

  // IntersectionObserver for Infinite Scroll
  useEffect(() => {
    if (activeTab !== 'reviews') return;

    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreReviews && !isLoadingReviews && !isFetchingMoreReviews) {
          loadNextReviewsPage();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [activeTab, hasMoreReviews, isLoadingReviews, isFetchingMoreReviews, loadNextReviewsPage]);

  if (isLoading) {
    return (
      <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in">
        

        {/* Loading Spinner */}
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-10 h-10 text-stone-800 animate-spin" />
          <p className="text-sm font-medium text-stone-600">Loading Seller Storefront...</p>
        </div>
      </div>
    );
  }

  if (error || !storefrontData) {
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
          <p className="text-xs text-stone-600 leading-relaxed">{error || 'Unable to fetch store details.'}</p>
          <button
            onClick={loadData}
            className="px-5 py-2.5 bg-stone-900 text-white text-xs font-bold uppercase tracking-wider rounded-xs hover:bg-stone-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { seller, products: resellerProducts } = storefrontData;

  const sortedProducts = [...resellerProducts].sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    if (sortBy === 'newest') return b.id.localeCompare(a.id);
    return 0;
  });

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in">
      {/* Breadcrumb */}
      

      {/* Profile Header Hero Block */}
      <div className="relative bg-stone-900 text-white overflow-hidden">
        {/* Banner Image */}
        <div className="absolute inset-0 opacity-40 mix-blend-overlay">
          <img src={seller.banner} alt={seller.shopName} className="w-full h-full object-cover" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Logo */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white overflow-hidden bg-stone-800 shrink-0 shadow-xl">
              <img
                src={seller.store_image_url || seller.logo || 'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png'}
                alt={seller.shopName || seller.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png';
                }}
              />
            </div>

            {/* Meta */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-amber-400 text-stone-950 text-2xs font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-xs">
                  VERIFIED RESELLER
                </span>
                <span className="text-stone-300 text-xs font-medium flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>{seller.city}, Pakistan</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-brand-serif font-normal tracking-wide">
                {seller.shopName}
              </h1>

              <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
                {seller.description}
              </p>

              {/* Badges Row */}
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center space-x-1 text-amber-400 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{seller.rating} / 5.0 ({seller.reviewCount} Reviews)</span>
                </div>
                
                <div className="flex items-center space-x-1 text-stone-300">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>Member Since: {seller.joinedDate}</span>
                </div>
                <div className="flex items-center space-x-1 text-stone-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{seller.totalSales}+ Suits Sold</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Listings / Reviews) */}
      <div className="bg-white border-b border-stone-200 top-16 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('listings')}
              className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'listings'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
            >
              Surplus Listings ({sortedProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 ${activeTab === 'reviews'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Customer Reviews ({seller.reviewCount})</span>
            </button>
          </div>

          {activeTab === 'listings' && (
            <div className="flex items-center space-x-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-stone-50 border border-stone-200 text-stone-800 text-xs font-semibold rounded-xs py-1.5 px-2.5 focus:outline-none cursor-pointer"
              >
                <option value="featured">Sort: Featured</option>
                <option value="newest">Sort: Newest First</option>
                <option value="price-low">Sort: Price (Low to High)</option>
                <option value="price-high">Sort: Price (High to Low)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === 'listings' ? (
          sortedProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {sortedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={onQuickView}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  isWishlisted={wishlistIds.includes(product.id)}
                  onSelectProduct={onSelectProduct}
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-white rounded-lg border border-stone-200 p-8 max-w-md mx-auto space-y-2">
              <p className="text-sm font-bold text-stone-800">No Listings Found</p>
              <p className="text-xs text-stone-500">This reseller currently has no active surplus listings available.</p>
            </div>
          )
        ) : (
          <div className="space-y-6">
            {isLoadingReviews && paginatedReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="w-8 h-8 text-stone-800 animate-spin" />
                <p className="text-xs font-medium text-stone-500">Loading Customer Reviews...</p>
              </div>
            ) : reviewsError && paginatedReviews.length === 0 ? (
              <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-lg border border-stone-200 text-center space-y-3 shadow-xs">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs font-semibold text-stone-800">{reviewsError}</p>
                <button
                  onClick={loadInitialReviews}
                  className="px-4 py-2 bg-stone-900 text-white text-xs font-bold uppercase tracking-wider rounded-xs hover:bg-stone-800 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : paginatedReviews.length > 0 ? (
              <>
                {/* Responsive 3-Column Grid on Large Screens */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {paginatedReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-6 bg-white rounded-xl border border-stone-200/80 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm"
                    >
                      <div>
                        {/* Top Header: Stars on Left, Date on Right */}
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-1 text-amber-500">
                            {[...Array(rev.rating)].map((_, i) => (
                              <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                            ))}
                          </div>
                          <span className="text-xs text-stone-400 font-normal">{rev.date}</span>
                        </div>

                        {/* Comment Quote */}
                        <p className="text-stone-700 text-xs sm:text-sm leading-relaxed mt-4">
                          "{rev.comment}"
                        </p>
                      </div>

                      {/* Footer with Divider Line */}
                      <div>
                        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
                          <span className="font-bold text-stone-900 text-xs sm:text-sm">
                            {rev.userName}
                          </span>
                          {rev.verifiedPurchase && (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50/80 border border-emerald-300/80 px-2.5 py-1 rounded-sm flex items-center space-x-1">
                              <span>✓</span>
                              <span>Verified Buyer</span>
                            </span>
                          )}
                        </div>

                        {rev.resellerReply && (
                          <div className="mt-3 p-3 bg-stone-50 border-l-2 border-stone-900 rounded-xs text-xs text-stone-800">
                            <span className="font-bold block text-stone-900 mb-1">
                              Response from Seller ({seller.shopName}):
                            </span>
                            <span>{rev.resellerReply}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Infinite Scroll Sentinel */}
                <div ref={observerTargetRef} className="py-6 flex items-center justify-center min-h-[60px]">
                  {isFetchingMoreReviews && (
                    <div className="flex items-center space-x-2 text-stone-600 text-xs font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-stone-800" />
                      <span>Loading more reviews...</span>
                    </div>
                  )}
                  {!hasMoreReviews && paginatedReviews.length > 0 && (
                    <p className="text-xs text-stone-400 font-medium">
                      Showing all {paginatedReviews.length} reviews
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="py-16 text-center bg-white rounded-lg border border-stone-200 p-8 max-w-md mx-auto space-y-2">
                <p className="text-sm font-bold text-stone-800">No Customer Reviews Yet</p>
                <p className="text-xs text-stone-500">Be the first to review products from this seller after purchasing!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
