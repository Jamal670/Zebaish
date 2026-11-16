import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { homeCategories } from '@/lib/home-static-data';

export const ShopByCategory: React.FC = () => {
  if (homeCategories.length === 0) return null;

  return (
    <section className="py-6 sm:py-8 md:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
            Shop by Category
          </h2>
          {/* <Link
            href="/shop"
            className="text-[10px] sm:text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
          >
            View All
          </Link> */}
        </div>

        {/* Horizontally scrollable on all screen sizes */}
        <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
          {homeCategories.map((cat) => (
            <Link
              key={cat.id}
              href={cat.href}
              className="group block rounded-xl overflow-hidden bg-stone-100 shadow-sm hover:shadow-md transition-shadow shrink-0 snap-start
                         w-[45%]           /* mobile: ~2 cards */
                         sm:w-[30%]        /* small tablet: ~3 cards */
                         md:w-[23%]        /* tablet: ~4 cards */
                         lg:w-[15.5%]      /* desktop: ~6 cards */
                         xl:w-[15.5%]      /* large monitor: ~6 cards */
                         "
            >
              <div className="relative aspect-[5/6] overflow-hidden">
                <Image  
                  src={cat.image}
                  alt={cat.imageAlt}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 23vw, 16vw"
                />
                {/* Gradient overlay for name legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-3 right-3 text-white text-xs sm:text-sm font-bold leading-tight">
                  {cat.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};