import React, { useEffect, useState } from 'react';
import { HERO_SLIDES } from '@/data/mockData';

export const HeroCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        return (prevIndex + 1) % HERO_SLIDES.length;
      });
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative w-full overflow-hidden select-none">
      {/* Hero Carousel Container */}
      <div
        className="
          relative
          w-full
          h-[50vh]
          min-h-[320px]
          sm:h-[60vh]
          md:h-[70vh]
          lg:h-[80vh]
          xl:h-screen
          overflow-hidden
        "
      >
        {HERO_SLIDES.map((slide, index) => {
          const imageSrc =
            typeof slide.image === 'string'
              ? slide.image
              : (slide.image as any)?.src || slide.image;

          return (
            <div
              key={slide.id}
              className={`
                absolute
                inset-0
                w-full
                h-full
                transition-opacity
                duration-1000
                ease-in-out
                ${
                  index === currentIndex
                    ? 'z-10 opacity-100'
                    : 'z-0 opacity-0'
                }
              `}
            >
              <img
                src={imageSrc}
                alt={`Hero Slide ${index + 1}`}
                className="
                  block
                  w-full
                  h-full
                  object-fill
                "
              />
            </div>
          );
        })}

        {/* Pagination */}
        <div className="absolute bottom-4 left-0 right-0 z-30 flex justify-center gap-2 px-4 sm:bottom-6">
          {HERO_SLIDES.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`
                h-0.5
                transition-all
                duration-300
                ${
                  index === currentIndex
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