'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const HERO_SLIDES = [
  {
    id: 'slide-1',
    image: '/images/home/banner1.jpg',  
    imageAlt: 'Zebaish Marketplace Banner',
    title: 'Find Everything You Love in One Place',
    subtitle: 'Fashion, Tech, LIfestyle & More',
    cta: 'Start Shopping',
    href: '/shop',
  },
  {
    id: 'slide-2',
    image: '/images/home/hero-2-fashion2.jpg',
    imageAlt: 'Fashion & Accessories Collection',
    eyebrow: 'Fashion & Accessories',
    title: 'Explore Fashion & Accessories',
    subtitle: 'Curated collections from independent sellers nationwide.',
    cta: 'Shop Fashion',
    href: '/shop?category=Fashion',
  },
  {
    id: 'slide-3',
    image: '/images/home/hero-3-home.jpg',
    imageAlt: 'Home & Garden Essentials',
    eyebrow: 'Home & Garden',
    title: 'Upgrade Your Home',
    subtitle: 'Furniture, decor and garden essentials for every space.',
    cta: 'Shop Home & Garden',
    href: '/shop?category=Home+%26+Garden',
  },
];

export const HeroCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const total = HERO_SLIDES.length;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(goNext, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, goNext]);

  return (
    <section
      className="relative w-full overflow-hidden select-none bg-stone-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      {/* Hero Carousel Container */}
      <div
        className="
          relative
          w-full
          h-[420px]
          md:h-[620px]
          overflow-hidden
        "
      >
        {HERO_SLIDES.map((slide, index) => {
          const imageSrc =
            typeof slide.image === 'string'
              ? slide.image
              : (slide.image as any)?.src || slide.image;

          const isActive = index === currentIndex;

          return (
            <div
              key={slide.id}
              className={`
                absolute
                inset-0
                w-full
                h-full
                transition-opacity
                duration-700
                ease-in-out
                ${isActive ? 'z-10 opacity-100 pointer-events-auto' : 'z-0 opacity-0 pointer-events-none'}
              `}
              aria-hidden={!isActive}
            >
              {/* Background Image */}
              <img
                src={imageSrc}
                alt={slide.imageAlt || `Hero Slide ${index + 1}`}
                className="
                  block
                  w-full
                  h-full
                  object-cover
                "
              />

              {/* First Slide: Text content and CTA button */}
              {index === 0 ? (
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {/* Subtle dark gradient overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-transparent pointer-events-none" />
                  <div className="absolute bottom-[20%] sm:bottom-[24%] md:bottom-[28%] left-4 sm:left-6 md:left-[8%] lg:left-[10%] pointer-events-auto max-w-none space-y-2 sm:space-y-2.5 md:space-y-3">
                    {slide.title && (
                      <h2 className="text-[18px] xs:text-[20px] sm:text-[26px] md:text-[32px] lg:text-4xl xl:text-5xl font-bold text-white leading-tight whitespace-nowrap drop-shadow-md">
                        {slide.title}
                      </h2>
                    )}
                    {slide.subtitle && (
                      <p className="text-[12px] xs:text-[13px] sm:text-[14px] md:text-[15px] lg:text-base font-medium text-stone-200 leading-relaxed whitespace-nowrap drop-shadow-sm">
                        {slide.subtitle}
                      </p>
                    )}
                    {slide.cta && (
                      <div className="pt-1 sm:pt-2">
                        <Link
                          href={slide.href}
                          className="inline-block px-6 py-2.5 sm:px-8 sm:py-3.5 bg-white hover:bg-stone-100 text-stone-900 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors shadow-lg cursor-pointer whitespace-nowrap"
                        >
                          {slide.cta}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Dark Gradient Overlay for remaining slides */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent pointer-events-none" />

                  {/* Text Content & CTA Button for remaining slides */}
                  <div className="absolute inset-0 flex items-center z-20 pointer-events-none">
                    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                      <div className="max-w-none space-y-2 sm:space-y-3 md:space-y-4 pointer-events-auto">
                        {slide.eyebrow && (
                          <p className="text-amber-400 text-[11px] xs:text-[12px] sm:text-xs md:text-sm font-semibold uppercase tracking-widest whitespace-nowrap">
                            {slide.eyebrow}
                          </p>
                        )}
                        {slide.title && (
                          <h2 className="text-[18px] xs:text-[20px] sm:text-[26px] md:text-[32px] lg:text-4xl xl:text-5xl font-bold text-white leading-tight whitespace-nowrap drop-shadow-md">
                            {slide.title}
                          </h2>
                        )}
                        {slide.subtitle && (
                          <p className="text-[12px] xs:text-[13px] sm:text-[14px] md:text-[15px] lg:text-base text-stone-200 font-medium leading-relaxed whitespace-nowrap drop-shadow-sm">
                            {slide.subtitle}
                          </p>
                        )}
                        {slide.cta && (
                          <div className="pt-1 sm:pt-2">
                            <Link
                              href={slide.href}
                              className="inline-block px-6 py-2.5 sm:px-7 sm:py-3 bg-white hover:bg-stone-100 text-stone-900 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors shadow-md cursor-pointer whitespace-nowrap"
                            >
                              {slide.cta}
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Prev / Next Navigation Arrows */}
        <button
          type="button"
          onClick={goPrev}
          className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 items-center justify-center rounded-full transition-colors cursor-pointer ${currentIndex === 0
              ? 'bg-black/10 hover:bg-black/25 text-stone-900 backdrop-blur-sm'
              : 'bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm'
            }`}
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={goNext}
          className={`hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 items-center justify-center rounded-full transition-colors cursor-pointer ${currentIndex === 0
              ? 'bg-black/10 hover:bg-black/25 text-stone-900 backdrop-blur-sm'
              : 'bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm'
            }`}
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Pagination Line/Dot Indicators */}
        <div className="absolute bottom-2.5 left-0 right-0 z-30 flex justify-center gap-2 px-4">
          {HERO_SLIDES.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`
                h-1
                rounded-full
                transition-all
                duration-300
                cursor-pointer
                ${currentIndex === 0
                  ? index === currentIndex
                    ? 'w-8 bg-stone-900 sm:w-10'
                    : 'w-4 bg-stone-900/30 hover:bg-stone-900/60 sm:w-6'
                  : index === currentIndex
                    ? 'w-8 bg-white sm:w-10'
                    : 'w-4 bg-white/40 hover:bg-white/70 sm:w-6'
                }
              `}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;
