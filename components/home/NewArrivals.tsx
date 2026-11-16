'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RotateCcw, PackageOpen } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useNewArrivals, prefetchNewArrivals } from '@/hooks/useNewArrivals';
import { ProductCard } from './ProductCard';

export const CATEGORIES = [
  { label: 'Fashion',         slug: 'fashion' },
  { label: 'Home & Garden',   slug: 'home-garden' },
  { label: 'Electronics',     slug: 'electronics' },
  { label: 'Health & Beauty', slug: 'health-beauty' },
] as const;

export type NewArrivalCategoryItem = (typeof CATEGORIES)[number];

const SKELETON_COUNT = 8;

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-white border border-stone-100 shadow-xs animate-pulse">
      {/* 3:4 portrait block */}
      <div className="aspect-[3/4] bg-stone-100 w-full" />
      {/* Info lines: title, price, seller */}
      <div className="p-3 sm:p-3.5 space-y-2">
        <div className="h-3.5 bg-stone-200/80 rounded w-4/5" />
        <div className="h-4 bg-stone-200/90 rounded w-1/3" />
        <div className="h-2.5 bg-stone-200/60 rounded w-1/2" />
      </div>
    </div>
  );
}

function ShowAllCard({ category }: { category: NewArrivalCategoryItem }) {
  return (
    <Link
      href={{ pathname: '/shop', query: { category: category.label } }}
      aria-label={`Show all ${category.label} products`}
      className="group flex flex-col items-center justify-center text-center p-4 rounded-xl aspect-[3/4] bg-stone-50 hover:bg-stone-100/80 border border-stone-200 hover:border-stone-300 shadow-xs hover:shadow-md transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-stone-900"
    >
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-stone-200/80 group-hover:bg-stone-900 text-stone-700 group-hover:text-white flex items-center justify-center transition-colors mb-2.5 sm:mb-3">
        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
      <span className="text-xs sm:text-sm font-semibold text-stone-900 line-clamp-1">
        Show All
      </span>
      <span className="text-[11px] sm:text-xs text-stone-500 mt-0.5 line-clamp-1">
        {category.label}
      </span>
    </Link>
  );
}

export const NewArrivals: React.FC = () => {
  const [selectedCategory, setSelectedCategory] =
    useState<NewArrivalCategoryItem>(CATEGORIES[0]);

  const queryClient = useQueryClient();
  const {
    data: products = [],
    isPending,
    isError,
    refetch,
  } = useNewArrivals(selectedCategory.slug);

  // Tab switch + smooth scroll into view
  const handleSelect = useCallback(
    (cat: NewArrivalCategoryItem, el: HTMLButtonElement) => {
      setSelectedCategory(cat);
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    },
    []
  );

  // Prefetch data on hover or focus of tab
  const handlePrefetch = useCallback(
    (slug: string) => {
      if (slug === selectedCategory.slug) return;
      prefetchNewArrivals(queryClient, supabase, slug);
    },
    [queryClient, selectedCategory.slug]
  );

  return (
    <section className="py-6 sm:py-8 md:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header: heading on the left + category tabs on the extreme right */}
        <div className="flex flex-row flex-nowrap items-center justify-between gap-10 sm:gap-6 mb-6">
          {/* Heading — fixed on the left */}
          <h2 className="shrink-0 text-sm sm:text-lg md:text-xl font-bold text-stone-900 tracking-tight whitespace-nowrap">
            New Arrivals
          </h2>

          {/* Category tabs — aligned to the extreme right */}
          <div
            role="tablist"
            aria-label="New arrivals categories"
            className="flex-1 min-w-0 flex flex-row flex-nowrap items-center justify-end gap-4 sm:gap-6 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory.slug === cat.slug;

              return (
                <button
                  key={cat.slug}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={(e) => handleSelect(cat, e.currentTarget)}
                  onPointerEnter={() => handlePrefetch(cat.slug)}
                  onFocus={() => handlePrefetch(cat.slug)}
                  className={`shrink-0 whitespace-nowrap cursor-pointer border-b-2 pb-1 text-[10px] sm:text-xs md:text-sm transition-colors ${
                    isSelected
                      ? 'border-stone-900 text-stone-900 font-bold'
                      : 'border-transparent text-stone-500 hover:text-stone-800 font-medium'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product grid / states */}
        {isPending ? (
          <div
            role="tabpanel"
            aria-busy="true"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5"
          >
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isError ? (
          <div
            role="tabpanel"
            className="w-full py-12 sm:py-16 flex flex-col items-center justify-center text-center px-4 rounded-2xl bg-stone-50/60 border border-stone-200 space-y-3"
          >
            <p className="text-xs sm:text-sm text-stone-500">
              Couldn&apos;t load new arrivals.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-800 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : products.length > 0 ? (
          <div
            role="tabpanel"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5"
          >
            {products.slice(0, 7).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {/* Show All card only renders when products are found */}
            <ShowAllCard category={selectedCategory} />
          </div>
        ) : (
          <div
            role="tabpanel"
            className="w-full py-12 sm:py-16 flex flex-col items-center justify-center text-center px-4 rounded-2xl bg-stone-50/60 border border-dashed border-stone-200"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3.5 sm:mb-4">
              <PackageOpen className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900 mb-1">
              Oops!
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 max-w-md">
              This product is not available in this category right now.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
