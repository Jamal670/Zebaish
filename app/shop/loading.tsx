import React from 'react';

export default function ShopLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="h-8 bg-stone-200 rounded-md w-48 mb-6"></div>
      
      {/* Toolbar Skeleton */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-stone-200">
        <div className="h-10 bg-stone-200 rounded-md w-32"></div>
        <div className="h-10 bg-stone-200 rounded-md w-40"></div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white border border-stone-100 rounded-xl overflow-hidden shadow-2xs">
            <div className="aspect-[3/4] bg-stone-200"></div>
            <div className="p-3 space-y-2">
              <div className="h-3 bg-stone-200 rounded-xs w-1/3"></div>
              <div className="h-4 bg-stone-200 rounded-xs w-3/4"></div>
              <div className="h-4 bg-stone-200 rounded-xs w-1/2 mt-2"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
