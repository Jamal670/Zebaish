'use client';

import React, { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Star, AlertCircle, MessageSquare, ArrowLeft } from 'lucide-react';
import { useSellerReviews, ReviewItemData } from '@/hooks/useSellerReviews';

interface ReviewsViewProps {
  sellerId?: string;
  productId?: string | null;
}

export const ReviewsView: React.FC<ReviewsViewProps> = ({
  productId: propProductId,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Validate activeProductId from prop or searchParams
  const activeProductId = propProductId !== undefined ? propProductId : searchParams?.get('productId') || null;

  const {
    reviews,
    averageRating,
    totalCount,
    ratingCounts,
    productTitle,
    isBreakdownLoading,
    isListLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    reload,
  } = useSellerReviews({
    productId: activeProductId,
  });

  const observerTargetRef = useRef<HTMLDivElement>(null);

  // Setup IntersectionObserver for Infinite Scroll
  useEffect(() => {
    const element = observerTargetRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isListLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '120px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isListLoading, loadMore]);

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
            {isBreakdownLoading ? (
              <div className="space-y-2 py-2">
                <div className="h-10 w-28 bg-stone-200 rounded animate-pulse mx-auto" />
                <div className="h-5 w-24 bg-stone-200 rounded animate-pulse mx-auto" />
                <div className="h-4 w-32 bg-stone-200 rounded animate-pulse mx-auto" />
              </div>
            ) : (
              <>
                <div className="text-4xl sm:text-5xl font-black text-stone-900 tracking-tight font-mono">
                  {averageRating.toFixed(1)} <span className="text-xl sm:text-2xl font-bold text-stone-400">/ 5</span>
                </div>
                <div className="flex justify-center text-amber-400 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${star <= Math.round(averageRating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-stone-300'
                        }`}
                    />
                  ))}
                </div>
                <p className="text-xs font-bold text-stone-600 uppercase tracking-wider pt-1">
                  {totalCount} Total {totalCount === 1 ? 'Review' : 'Reviews'}
                </p>
              </>
            )}
          </div>

          {/* Rating Breakdown Distribution Bars */}
          <div className="md:col-span-2 space-y-2.5">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = ratingCounts[star] || 0;
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

              return (
                <div key={star} className="flex items-center text-xs space-x-3">
                  <span className="w-9 font-bold text-stone-800 flex items-center justify-end shrink-0">
                    {star} <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 ml-1" />
                  </span>
                  <div className="flex-1 bg-stone-200 rounded-full h-3 overflow-hidden shadow-inner">
                    {isBreakdownLoading ? (
                      <div className="bg-stone-300 h-full rounded-full animate-pulse w-full" />
                    ) : (
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                  <span className="min-w-[85px] font-mono text-xs font-semibold text-stone-700 text-right shrink-0">
                    {isBreakdownLoading ? (
                      <span className="text-stone-400 font-normal">Loading...</span>
                    ) : (
                      `${count} ${count === 1 ? 'review' : 'reviews'} (${pct}%)`
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ERROR WITH RETRY */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700 font-medium">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={reload}
              className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* REVIEWS LIST */}
        {isListLoading && reviews.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="p-4 sm:p-5 border border-stone-200 rounded-xl bg-stone-50/50 animate-pulse space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200 gap-3">
                  <div className="space-y-1.5">
                    <div className="h-4 bg-stone-200 rounded w-32" />
                    <div className="h-3 bg-stone-200 rounded w-48" />
                  </div>
                  <div className="h-4 bg-stone-200 rounded w-24 shrink-0" />
                </div>
                <div className="h-12 bg-white rounded-lg border border-stone-200/80" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
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
                    </div>

                    {/* Product info (when NOT scoped to a single product) */}
                    {!activeProductId && rev.productTitle && (
                      <div className="flex items-center space-x-2.5 text-xs text-stone-600 pt-0.5">
                        <span className="font-semibold text-stone-900 block line-clamp-1">
                          {rev.productTitle}
                        </span>
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
                    {rev.createdAt && (
                      <span className="text-xs text-stone-400 font-mono">
                        {new Date(rev.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Review Body (rendered as plain text, omitted if null or empty) */}
                {rev.review ? (
                  <p className="text-xs sm:text-sm text-stone-800 leading-relaxed italic bg-white p-3.5 sm:p-4 rounded-lg border border-stone-200/80">
                    &ldquo;{rev.review}&rdquo;
                  </p>
                ) : null}
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
