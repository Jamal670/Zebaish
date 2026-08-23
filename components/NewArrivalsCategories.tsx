import React, { useRef } from 'react';
import { NEW_ARRIVALS_CATEGORIES } from '@/data/mockData';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface NewArrivalsCategoriesProps {
  onSelectCategory?: (category: string) => void;
}

export const NewArrivalsCategories: React.FC<NewArrivalsCategoriesProps> = ({
  onSelectCategory,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;

      scrollRef.current.scrollBy({
        left:
          direction === 'left'
            ? -containerWidth
            : containerWidth,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="py-8 md:py-12 bg-white border-b border-stone-100 overflow-hidden">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-[40px]">
        {/* Header */}
        <div className="mb-5 sm:mb-6">
          <h2 className="font-brand-serif text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal text-stone-900 tracking-wide whitespace-nowrap">
            New Arrivals
          </h2>

          <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-stone-500 mt-1 font-light tracking-wide truncate max-w-full">
            Explore the Newest Additions Today
          </p>
        </div>

        {/* Carousel */}
        <div className="relative group w-full">
          {/* Left Arrow */}
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll Left"
            className="
              hidden md:flex
              absolute left-2 top-1/2 -translate-y-1/2
              z-20
              w-10 h-10
              bg-white/90 hover:bg-white
              text-stone-800
              shadow-lg
              rounded-full
              items-center justify-center
              border border-stone-200
              transition-all
              opacity-0 group-hover:opacity-100
            "
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Cards */}
          <div
            ref={scrollRef}
            className="
              flex
              gap-4 sm:gap-5
              overflow-x-auto
              no-scrollbar
              scroll-smooth
              py-1
              w-full
            "
          >
            {NEW_ARRIVALS_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                onClick={() => onSelectCategory?.(cat.title)}
                className="
                  flex-none
                  w-[250px]
                  sm:w-[310px]
                  md:w-[360px]
                  lg:w-[400px]
                  xl:w-[440px]
                  aspect-[472/539]
                  cursor-pointer
                  group/card
                  relative
                  rounded-xl
                  overflow-hidden
                  bg-stone-100
                "
              >
                <img
                  src={
                    typeof cat.image === 'string'
                      ? cat.image
                      : (cat.image as any).src
                  }
                  alt={cat.title}
                  className="
                    w-full
                    h-full
                    object-cover
                    object-top
                    transition-transform
                    duration-700
                    ease-out
                    group-hover/card:scale-105
                  "
                />

                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent pointer-events-none" />

                {/* Category */}
                <div className="absolute bottom-5 left-5 right-5 pointer-events-none">
                  <span className="font-brand-serif text-white text-lg sm:text-xl md:text-2xl font-normal drop-shadow-md tracking-wide block">
                    {cat.title}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Arrow */}
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll Right"
            className="
              hidden md:flex
              absolute right-2 top-1/2 -translate-y-1/2
              z-20
              w-10 h-10
              bg-white/90 hover:bg-white
              text-stone-800
              shadow-lg
              rounded-full
              items-center justify-center
              border border-stone-200
              transition-all
              opacity-0 group-hover:opacity-100
            "
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};