import React from 'react';
import Link from 'next/link';
import { ProductCard } from './ProductCard';
import { trendingProducts } from '@/lib/home-static-data';

export const TrendingProducts: React.FC = () => {
  if (trendingProducts.length === 0) return null;

  return (
    <section className="py-6 sm:py-8 md:py-10 px-4 sm:px-6 lg:px-8 bg-stone-50/50">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
            Trending Products
          </h2>
          <Link
            href="/shop?sort=trending"
            className="text-xs sm:text-sm font-semibold text-stone-500 hover:text-stone-900 transition-colors"
          >
            View All →
          </Link>
        </div>
        <p className="text-xs sm:text-sm text-stone-500 mb-8">
          Products getting attention across categories
        </p>

        {/* Product grid: 2 cols mobile, 3 md, 4 lg */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {trendingProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

