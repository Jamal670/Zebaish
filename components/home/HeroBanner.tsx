'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { heroSlides } from '@/lib/home-static-data';

export const HeroBanner: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = heroSlides.length;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const goNext = useCallback(() => setCurrent((p) => (p + 1) % total), [total]);
  const goPrev = useCallback(() => setCurrent((p) => (p - 1 + total) % total), [total]);

  useEffect(() => {
    if (prefersReducedMotion || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(goNext, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused, prefersReducedMotion, goNext]);

  if (heroSlides.length === 0) return null;

  return (
    <section
      className="relative w-full h-[420px] md:h-[520px] overflow-hidden bg-stone-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="Homepage hero banner"
    >
      {heroSlides.map((slide, i) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
          role="group"
          aria-roledescription="slide"
          aria-label={`Slide ${i + 1} of ${total}`}
          aria-hidden={i !== current}
        >
          <Image
            src={slide.image}
            alt={slide.imageAlt}
            fill
            className="object-cover"
            sizes="100vw"
            priority={i === 0}
          />
          {/* Dark gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          {/* Text content */}
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
              <div className="max-w-none space-y-2 sm:space-y-3 md:space-y-4">
                {slide.eyebrow ? (
                  <p className="text-amber-400 text-[11px] xs:text-[12px] sm:text-xs md:text-sm font-semibold uppercase tracking-widest whitespace-nowrap">
                    {slide.eyebrow}
                  </p>
                ) : null}
                <h2 className="text-[18px] xs:text-[20px] sm:text-[26px] md:text-[32px] lg:text-4xl xl:text-5xl font-bold text-white leading-tight whitespace-nowrap drop-shadow-md">
                  {slide.title}
                </h2>
                <p className="text-[12px] xs:text-[13px] sm:text-[14px] md:text-[15px] lg:text-base text-stone-200 font-medium leading-relaxed whitespace-nowrap drop-shadow-sm">
                  {slide.subtitle}
                </p>
                <Link
                  href={slide.href}
                  className="inline-block mt-1 sm:mt-2 px-6 py-2.5 sm:px-7 sm:py-3 bg-white text-stone-900 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-stone-100 transition-colors shadow-md whitespace-nowrap"
                >
                  {slide.cta}
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Prev / Next arrows (hidden on mobile) */}
      <button
        type="button"
        onClick={goPrev}
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white transition-colors cursor-pointer"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={goNext}
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white transition-colors cursor-pointer"
        aria-label="Next slide"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {heroSlides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
              i === current ? 'bg-white scale-110' : 'bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

