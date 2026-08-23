import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HorizontalScrollRowProps {
  children: React.ReactNode;
  className?: string;
  showScrollButtons?: boolean;
}

export const HorizontalScrollRow: React.FC<HorizontalScrollRowProps> = ({
  children,
  className = '',
  showScrollButtons = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group">
      {showScrollButtons && (
        <>
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white/90 shadow-md rounded-full border border-stone-200 text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-stone-50 cursor-pointer hidden sm:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white/90 shadow-md rounded-full border border-stone-200 text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-stone-50 cursor-pointer hidden sm:flex"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className={`flex flex-nowrap overflow-x-auto snap-x snap-mandatory space-x-3 sm:space-x-4 pb-2 pt-1 scroll-smooth ${className}`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
    </div>
  );
};
