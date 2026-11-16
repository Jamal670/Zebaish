import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { sellerBenefits } from '@/lib/home-static-data';

export const BecomeSeller: React.FC = () => {
  return (
    <section className="py-6 sm:py-8 md:py-10 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Left on desktop, 2nd on mobile: Text */}
          <div className="order-2 md:order-1 space-y-5">
            <p className="text-amber-600 text-xs font-bold uppercase tracking-widest">
              Grow your business
            </p>
            <h2 className="text-xl md:text-2xl lg:text-2xl  font-bold text-stone-900 mb-13">
              Join 200+ Verified Sellers Nationwide
            </h2>

            <ul className="space-y-2.5">
              {sellerBenefits.map((benefit, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-stone-700 font-medium">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-stone-900 text-white shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
            <Link
              href="/reseller/signup"
              className="inline-block px-6 py-3 bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm"
            >
              Become a Seller
            </Link>
          </div>

          {/* Right on desktop, 1st on mobile: Image */}
          <div className="order-1 md:order-2 relative aspect-video rounded-2xl overflow-hidden bg-stone-200 shadow-sm">
            <Image
              src="/images/home/sellerstore.jpg"
              alt="Start selling on Zebaish"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
