import React from 'react';
import Image from 'next/image';
import { Maximize2 } from 'lucide-react';

export interface ProductMainImageProps {
  src: string;
  alt: string;
  brand?: string | null;
  onOpenZoom?: () => void;
}

/**
 * Product main image viewer with a shorter aspect-[4/5] container, capped desktop width,
 * priority loading for LCP optimization, brand badge, and zoom trigger.
 */
export function ProductMainImage({
  src,
  alt,
  brand,
  onOpenZoom,
}: ProductMainImageProps) {
  return (
    <div className="relative mx-auto sm:mx-0 w-full max-w-[520px] aspect-[4/5] overflow-hidden rounded-xl sm:rounded-2xl bg-stone-100 group shadow-2xs">
      <Image
        src={src}
        alt={alt || 'Product image'}
        fill
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 520px"
        className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
      />

      {/* Brand Badge Overlay */}
      {brand && (
        <div className="absolute top-4 left-4 z-10 flex flex-col space-y-1.5 pointer-events-none">
          <span className="bg-black/90 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-xs backdrop-blur-xs">
            {brand}
          </span>
        </div>
      )}

      {/* Zoom Button */}
      {onOpenZoom && (
        <button
          type="button"
          onClick={onOpenZoom}
          className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white text-stone-800 rounded-full shadow-sm transition-all cursor-pointer z-10"
          title="Fullscreen Zoom"
          aria-label="Fullscreen Zoom"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

