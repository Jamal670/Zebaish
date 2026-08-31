import React from 'react';

export default function AccountLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Header Profile Summary Skeleton */}
      <div className="bg-stone-200 rounded-lg p-6 sm:p-8 mb-8 h-28 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-full bg-stone-300"></div>
          <div className="space-y-2">
            <div className="h-6 bg-stone-300 rounded-md w-48"></div>
            <div className="h-4 bg-stone-300 rounded-xs w-32"></div>
          </div>
        </div>
      </div>

      {/* Tab Switcher Skeleton */}
      <div className="h-12 bg-stone-200 rounded-lg mb-8"></div>

      {/* Orders List Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-2xs">
            <div className="flex justify-between border-b border-stone-200 pb-4">
              <div className="h-4 bg-stone-200 rounded-xs w-32"></div>
              <div className="h-6 bg-stone-200 rounded-full w-24"></div>
            </div>
            <div className="h-20 bg-stone-100 rounded-md"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
