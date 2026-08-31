import React from 'react';

export default function ProductLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left: Image Gallery Skeleton */}
        <div className="space-y-4">
          <div className="aspect-[3/4] bg-stone-200 rounded-lg"></div>
          <div className="flex space-x-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-16 h-20 bg-stone-200 rounded-md shrink-0"></div>
            ))}
          </div>
        </div>

        {/* Right: Product Details Skeleton */}
        <div className="space-y-6">
          <div className="h-4 bg-stone-200 rounded-xs w-24"></div>
          <div className="h-8 bg-stone-200 rounded-md w-3/4"></div>
          <div className="h-6 bg-stone-200 rounded-md w-1/3"></div>

          <div className="border-t border-b border-stone-200 py-6 space-y-3">
            <div className="h-4 bg-stone-200 rounded-xs w-20"></div>
            <div className="flex space-x-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-12 h-10 bg-stone-200 rounded-md"></div>
              ))}
            </div>
          </div>

          <div className="h-12 bg-stone-200 rounded-md w-full"></div>
        </div>
      </div>
    </div>
  );
}
