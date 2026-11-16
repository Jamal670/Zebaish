import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { featuredSeller } from '@/lib/home-static-data';

export const FeaturedSellers: React.FC = () => {
  const data = featuredSeller;

  return (
    <section className="py-6 sm:py-8 md:py-10 px-4 sm:px-6 lg:px-8 bg-stone-50/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Left: Image */}
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-200 shadow-sm">
            <Image
              src="/images/home/featured-seller2.jpg"
              alt={data.imageAlt}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>

          {/* Right: Text */}
          <div className="space-y-5">
            <p className="text-amber-600 text-xs font-bold uppercase tracking-widest">
              {data.eyebrow}
            </p>
            <h2 className="text-2xl sm:text-2xl font-bold text-stone-900 leading-tight">
              {data.heading}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {data.paragraph}
            </p>
            <ul className="space-y-2.5">
              {data.bullets.map((bullet, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-stone-700 font-medium">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-stone-900 text-white shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
            {/* <Link
              href={data.href}
              className="inline-block px-6 py-3 bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm"
            >
              {data.cta}
            </Link> */}
          </div>
        </div>
      </div>
    </section>
  );
};

