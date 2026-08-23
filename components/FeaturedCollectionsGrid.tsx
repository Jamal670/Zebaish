'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FEATURED_CALLOUTS } from '@/data/mockData';

interface FeaturedCollectionsGridProps {
  onSelectCategory?: (category: string) => void;
}

export const FeaturedCollectionsGrid: React.FC<
  FeaturedCollectionsGridProps
> = ({ onSelectCategory }) => {
  const router = useRouter();

  const handleCardClick = (title: string) => {
    let category = title;

    // Card-specific category mapping
    if (title === '3 PIECE LAWN') {
      category = 'UNSTITCHED - 3 Piece Lawn';
    } else if (title === 'LUXURY PRET') {
      category = 'READY TO WEAR - Luxury Pret';
    }

    // Optional callback
    onSelectCategory?.(category);

    // Navigate to shop with category query
    router.push(`/shop?category=${encodeURIComponent(category)}`);
  };

  return (
    <section className="py-8 md:py-12 bg-white">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-[40px] space-y-4 md:space-y-6">

        {/* Row 1: 2 Large Portrait Banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {FEATURED_CALLOUTS.row1.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.title)}
              className="relative aspect-[3/4] sm:aspect-[4/5] md:aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 group cursor-pointer"
            >
              <img
                src={
                  typeof card.image === 'string'
                    ? card.image
                    : (card.image as any).src
                }
                alt={card.title}
                className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

              {/* Overlay Text */}
              <div className="absolute bottom-8 left-0 right-0 text-center px-4 pointer-events-none">
                <h3 className="font-brand-serif text-white text-2xl sm:text-3xl md:text-4xl font-normal tracking-[0.2em] uppercase drop-shadow-md">
                  {card.title}
                </h3>
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: 3 Portrait Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
          {FEATURED_CALLOUTS.row2.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.title)}
              className="relative aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 group cursor-pointer"
            >
              <img
                src={
                  typeof card.image === 'string'
                    ? card.image
                    : (card.image as any).src
                }
                alt={card.title}
                className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

              {/* Overlay Text */}
              <div className="absolute bottom-6 left-0 right-0 text-center px-4 pointer-events-none">
                <h3 className="font-brand-serif text-white text-lg sm:text-xl md:text-2xl font-normal tracking-[0.2em] uppercase drop-shadow-md">
                  {card.title}
                </h3>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};