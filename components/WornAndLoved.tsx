import React, { useRef } from 'react';
import { WORN_AND_LOVED_ITEMS } from '@/data/mockData';
import { ArrowLeft, ArrowRight, Heart, MessageCircle, Send, ShoppingBag } from 'lucide-react';

interface WornAndLovedProps {
  onShopNowClick?: (item: typeof WORN_AND_LOVED_ITEMS[0]) => void;
}

export const WornAndLoved: React.FC<WornAndLovedProps> = ({ onShopNowClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-12 md:py-16 bg-[#f8f8f8] border-t border-stone-200/60 overflow-hidden">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-[40px]">
        {/* Header */}
        <div className="relative flex items-center justify-center mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal text-stone-900 tracking-tight flex items-center space-x-2">
            <span>Worn & Loved</span>
            <span className="text-pink-500">❤️</span>
          </h2>

          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center space-x-4">
            <button
              onClick={() => scroll('left')}
              aria-label="Scroll left"
              className="text-stone-800 hover:text-black transition-colors focus:outline-none p-1"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 stroke-[1.75]" />
            </button>
            <button
              onClick={() => scroll('right')}
              aria-label="Scroll right"
              className="text-stone-800 hover:text-black transition-colors focus:outline-none p-1"
            >
              <ArrowRight className="w-5 h-5 md:w-6 md:h-6 stroke-[1.75]" />
            </button>
          </div>
        </div>

        {/* Horizontal Influencer Cards */}
        <div
  ref={scrollRef}
  className="flex space-x-4 sm:space-x-5 md:space-x-6 overflow-x-auto no-scrollbar scroll-smooth pb-4 pt-1 mx-0 px-0"
>
          {WORN_AND_LOVED_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex-none w-[220px] sm:w-[250px] md:w-[270px] lg:w-[280px] bg-white rounded-2xl overflow-hidden shadow-xs border border-stone-200/60 flex flex-col justify-between"
            >
              {/* Card Header: Avatar, Profile handle & Tag */}
              <div className="p-3.5 flex items-center space-x-3 bg-white">
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt={item.handle}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-stone-100"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-stone-200 shrink-0 flex items-center justify-center text-xs font-bold text-stone-600">
                    {item.handle.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold text-stone-900 truncate tracking-tight">
                    {item.handle}
                  </span>
                  <span className="text-2xs text-stone-400 font-normal leading-tight">
                    {item.tag}
                  </span>
                </div>
              </div>

              {/* Main Photo */}
              <div className="relative w-full aspect-[3/4.6] bg-stone-100 overflow-hidden group">
                <img
                  src={typeof item.image === 'string' ? item.image : (item.image as any).src}
                  alt={item.handle}
                  className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>

              {/* Card Footer Actions */}
              <div className="p-3.5 flex items-center justify-between bg-white border-t border-stone-100">
                <div className="flex items-center space-x-2.5">
                  <button aria-label="Like post" className="hover:scale-110 transition-transform">
                    <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                  </button>
                  <button aria-label="Comment" className="text-stone-400 hover:text-stone-700 transition-colors">
                    <MessageCircle className="w-4 h-4 stroke-[1.5]" />
                  </button>
                  <button aria-label="Share" className="text-stone-400 hover:text-stone-700 transition-colors">
                    <Send className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>

                <button
                  onClick={() => onShopNowClick && onShopNowClick(item)}
                  className="inline-flex items-center space-x-1.5 text-xs font-medium text-stone-800 hover:text-black transition-colors"
                >
                  <span>Shop Now</span>
                  <ShoppingBag className="w-4 h-4 text-stone-800 stroke-[1.5]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

