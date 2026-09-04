'use client';

import React, { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Star, Loader2, MessageSquare, AlertCircle, ShoppingBag, ArrowLeft, CheckCircle, Clock, XCircle } from 'lucide-react';
import useAuth from '@/src/hooks/useAuth';
import { useSellerReviews, ReviewItemData } from '@/src/hooks/useSellerReviews';

interface ReviewsViewProps {
  sellerId?: string;
  productId?: string | null;
}

export const ReviewsView: React.FC<ReviewsViewProps> = ({
  sellerId: propSellerId,
  productId: propProductId,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, resellerProfile } = useAuth();

  const activeSellerId = propSellerId || resellerProfile?.id || user?.id;
  const activeProductId = propProductId !== undefined ? propProductId : searchParams?.get('productId') || null;

  const {
    reviews,
    averageRating,
    totalCount,
    ratingCounts,
    productTitle,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
  } = useSellerReviews({
    sellerId: activeSellerId,
    productId: activeProductId,
    pageSize: 15,
  });

  // Dynamic calculation fallbacks for real-time rating breakdown and totals
  const displayTotalCount = React.useMemo(() => {
    if (totalCount > 0) return totalCount;
    return reviews.length;
  }, [totalCount, reviews]);

  const displayRatingCounts = React.useMemo(() => {
    const apiSum = Object.values(ratingCounts).reduce((a, b) => a + b, 0);
    if (apiSum > 0) return ratingCounts;

    const counts: { 5: number; 4: number; 3: number; 2: number; 1: number } = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };
    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))) as 1 | 2 | 3 | 4 | 5;
      counts[star] = (counts[star] || 0) + 1;
    });
    return counts;
  }, [ratingCounts, reviews]);

  const displayAverageRating = React.useMemo(() => {
    if (averageRating > 0) return averageRating;
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [averageRating, reviews]);

  const observerTargetRef = useRef<HTMLDivElement>(null);

  // Setup IntersectionObserver for Infinite Scroll
  useEffect(() => {
    const element = observerTargetRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '120px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, loadMore]);

  const getStatusBadge = (status: string) => {
    const norm = status ? status.toLowerCase() : 'approved';
    if (norm === 'approved') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-2xs sm:text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
          <CheckCircle className="w-3 h-3 text-emerald-600" />
          <span>Approved</span>
        </span>
      );
    }
    if (norm === 'pending') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-2xs sm:text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Pending</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-2xs sm:text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shrink-0">
        <XCircle className="w-3 h-3 text-rose-600" />
        <span>Rejected</span>
      </span>
    );
  };

  if (isLoading && reviews.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 sm:p-12 text-center shadow-2xs space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-stone-700 mx-auto" />
        <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-stone-600">
          Loading Verified Reviews...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-6 lg:p-8 shadow-2xs space-y-6">

        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-200 gap-4">
          <div>
            {activeProductId && (
              <button
                onClick={() => router.push('/dashboard/reviews')}
                className="inline-flex items-center text-xs font-bold text-stone-600 hover:text-stone-900 mb-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                View All Product Reviews
              </button>
            )}
            <h3 className="text-base sm:text-lg lg:text-lg font-extrabold uppercase tracking-wider text-stone-900">
              {activeProductId ? (productTitle ? `Reviews: ${productTitle}` : 'Product Reviews') : 'Reviews & Ratings'}
            </h3>
          </div>
        </div>

        {/* AVERAGE RATING SUMMARY & DISTRIBUTION BARS */}
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Main Score Box */}
          <div className="text-center md:border-r md:border-stone-200 md:pr-6 space-y-1.5">
            <div className="text-4xl sm:text-5xl font-black text-stone-900 tracking-tight font-mono">
              {displayAverageRating.toFixed(1)} <span className="text-xl sm:text-2xl font-bold text-stone-400">/ 5</span>
            </div>
            <div className="flex justify-center text-amber-400 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${star <= Math.round(displayAverageRating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-stone-300'
                    }`}
                />
              ))}
            </div>
            <p className="text-xs font-bold text-stone-600 uppercase tracking-wider pt-1">
              {displayTotalCount} Total {displayTotalCount === 1 ? 'Review' : 'Reviews'}
            </p>
          </div>

          {/* Rating Breakdown Distribution Bars */}
          <div className="md:col-span-2 space-y-2.5">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = displayRatingCounts[star] || 0;
              const pct = displayTotalCount > 0 ? Math.round((count / displayTotalCount) * 100) : 0;

              return (
                <div key={star} className="flex items-center text-xs space-x-3">
                  <span className="w-9 font-bold text-stone-800 flex items-center justify-end shrink-0">
                    {star} <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 ml-1" />
                  </span>
                  <div className="flex-1 bg-stone-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="min-w-[85px] font-mono text-xs font-semibold text-stone-700 text-right shrink-0">
                    {count} {count === 1 ? 'review' : 'reviews'} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* REVIEWS LIST */}
        {reviews.length === 0 ? (
          <div className="py-12 sm:py-16 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50 space-y-3">
            <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-stone-300 mx-auto" />
            <h4 className="text-xs sm:text-sm font-bold text-stone-900 uppercase tracking-wider">
              No Reviews Found
            </h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {activeProductId
                ? 'No customer reviews have been submitted for this specific product yet.'
                : 'No customer reviews found across your listed products.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((rev: ReviewItemData) => (
              <div
                key={rev.id}
                className="p-4 sm:p-5 border border-stone-200 rounded-xl bg-stone-50/50 hover:bg-stone-50 transition-colors space-y-3"
              >
                {/* Review Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200 gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-stone-900 text-xs sm:text-sm">
                        {rev.customerName}
                      </span>
                      {getStatusBadge(rev.status)}
                    </div>

                    {/* Product info (only when NOT scoped to a single product) */}
                    {!activeProductId && (
                      <div className="flex items-center space-x-2.5 text-xs text-stone-600 pt-0.5">
                        {rev.productImage && (
                          <img
                            src={rev.productImage}
                            alt={rev.productTitle}
                            className="w-7 h-9 object-cover rounded-xs border border-stone-200 bg-stone-100 shrink-0"
                          />
                        )}
                        <div>
                          <span className="font-semibold text-stone-900 block line-clamp-1">
                            {rev.productTitle}
                          </span>
                          <span className="text-2xs text-stone-400">{rev.productBrand}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rating Stars & Date */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${star <= rev.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-stone-200'
                            }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-stone-400 font-mono">
                      {new Date(rev.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Review Body */}
                <p className="text-xs sm:text-sm text-stone-800 leading-relaxed italic bg-white p-3.5 sm:p-4 rounded-lg border border-stone-200/80">
                  "{rev.review}"
                </p>
              </div>
            ))}

            {/* SKELETON LOADING STATE FOR NEXT BATCH */}
            {isLoadingMore && (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="p-5 border border-stone-200 rounded-xl bg-stone-50 animate-pulse space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-stone-200 rounded-sm w-32" />
                      <div className="h-4 bg-stone-200 rounded-sm w-24" />
                    </div>
                    <div className="h-16 bg-stone-200 rounded-lg" />
                  </div>
                ))}
              </div>
            )}

            {/* INFINITE SCROLL SENTINEL */}
            <div ref={observerTargetRef} className="h-4" />

            {/* END OF REVIEWS NOTICE */}
            {!hasMore && reviews.length > 0 && (
              <div className="pt-4 text-center text-xs font-semibold text-stone-400 uppercase tracking-wider border-t border-stone-100">
                &bull; You&apos;ve reached the end of reviews &bull;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewsView;
