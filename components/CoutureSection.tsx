import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Star, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Product } from '@/types';
import topShowroomImage from '@/src/assets/images/top_stores_showroom_1784731726898.jpg';
import storeAyesha from '@/src/assets/images/store_ayesha_lahore_1784731969228.jpg';
import storeZainab from '@/src/assets/images/store_zainab_karachi_1784731993765.jpg';
import storeRoyal from '@/src/assets/images/store_royal_threads_1784732014623.jpg';
import storeVault from '@/src/assets/images/store_lawn_vault_1784732035582.jpg';

interface CoutureSectionProps {
  onQuickView?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (productId: string) => void;
  wishlistIds?: string[];
  onSelectProduct?: (product: Product) => void;
  onSelectReseller?: (resellerId: string) => void;
}

const TOP_STORES = [
  {
    id: 'reseller-1',
    name: 'Ayesha Luxury Surplus',
    city: 'Lahore',
    rating: 4.9,
    salesCount: 890,
    activeSuits: 42,
    responseTime: '< 15 mins',
    banner: storeAyesha,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    specialty: 'Khaadi & Sapphire Surplus',
  },
  {
    id: 'reseller-2',
    name: 'Zainab Surplus Hub',
    city: 'Karachi',
    rating: 4.8,
    salesCount: 540,
    activeSuits: 28,
    responseTime: '< 30 mins',
    banner: storeZainab,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    specialty: 'Gul Ahmed & Bareeze',
  },
  {
    id: 'reseller-3',
    name: 'Royal Threads & Leftovers',
    city: 'Faisalabad',
    rating: 4.7,
    salesCount: 410,
    activeSuits: 19,
    responseTime: '< 1 hour',
    banner: storeRoyal,
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
    specialty: 'Sana Safinaz Couture',
  },
  {
    id: 'reseller-4',
    name: 'Khaadi & Lawn Vault',
    city: 'Islamabad',
    rating: 4.9,
    salesCount: 1120,
    activeSuits: 56,
    responseTime: '< 10 mins',
    banner: storeVault,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    specialty: 'Clearance Lawn Lots',
  },
];

export const CoutureSection: React.FC<CoutureSectionProps> = ({ onSelectReseller }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-10 md:py-14 bg-white border-t border-stone-100 overflow-hidden">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-[40px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          
          {/* Left Tall Feature Photo */}
          <div className="lg:col-span-4 relative min-h-[420px] lg:min-h-[500px] rounded-xl overflow-hidden bg-stone-900 group">
            <img
              src={typeof topShowroomImage === 'string' ? topShowroomImage : (topShowroomImage as any).src}
              alt="Top Stores Selling With Zebaish"
              className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
            <div className="absolute bottom-8 left-8 right-8 text-white pointer-events-none">
              <span className="text-[10px] uppercase font-extrabold tracking-[0.25em] text-amber-300 block mb-2">
                VERIFIED SELLER NETWORK
              </span>
              <h3 className="font-brand-serif text-3xl sm:text-4xl font-normal tracking-wide leading-tight">
                Top Stores Selling With Zebaish
              </h3>
              <p className="text-stone-300 text-xs mt-2 font-light line-clamp-2">
                Curated boutiques offering authentic Pakistani designer leftover rolls & clearance suits.
              </p>
            </div>
          </div>

          {/* Right Section: Header & Stores Carousel */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            {/* Header & Controls */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-4 mb-6">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-700 block mb-1">
                  FEATURED PARTNERS
                </span>
                <h2 className="font-brand-serif text-2xl sm:text-3xl md:text-4xl font-normal text-stone-900 tracking-wider uppercase">
                  TOP STORES
                </h2>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => onSelectReseller && onSelectReseller('reseller-1')}
                  className="text-xs font-semibold text-stone-800 hover:text-black underline underline-offset-4 tracking-wide transition-colors cursor-pointer hidden sm:block"
                >
                  View all stores
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => scroll('left')}
                    aria-label="Scroll left"
                    className="p-2 border border-stone-200 text-stone-700 hover:text-black hover:border-stone-400 rounded-full transition-colors cursor-pointer bg-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => scroll('right')}
                    aria-label="Scroll right"
                    className="p-2 border border-stone-200 text-stone-700 hover:text-black hover:border-stone-400 rounded-full transition-colors cursor-pointer bg-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Store Cards Horizontal Scroll Carousel - Matching original product card aspect ratio */}
            <div
              ref={scrollRef}
              className="flex gap-5 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pb-4 pt-1 w-full"
            >
              {TOP_STORES.map((store) => (
                <div
                  key={store.id}
                  onClick={() => onSelectReseller && onSelectReseller(store.id)}
                  className="flex-none w-[260px] sm:w-[280px] md:w-[310px] group cursor-pointer bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between transition-all hover:border-stone-400 hover:shadow-lg"
                >
                  {/* Full Tall Showcase Image (Matching original product card height/aspect ratio) */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-100">
                    <img
                      src={typeof store.banner === 'string' ? store.banner : (store.banner as any).src}
                      alt={store.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                    
                    {/* Top Overlay Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <span className="bg-stone-900/90 backdrop-blur-md text-amber-300 text-[10px] font-extrabold px-2.5 py-1 rounded-xs flex items-center space-x-1 shadow-sm">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>VERIFIED SELLER</span>
                      </span>

                      <span className="bg-white/95 text-stone-900 text-[11px] font-extrabold px-2.5 py-1 rounded-xs flex items-center space-x-1 shadow-sm">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{store.rating}</span>
                      </span>
                    </div>

                    {/* Bottom Gradient for Name readability inside image footer */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />

                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="flex items-center space-x-1.5 text-stone-300 text-[10px] uppercase font-medium tracking-wider mb-0.5">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>{store.city}</span>
                        <span>•</span>
                        <span>{store.responseTime}</span>
                      </div>
                      <h4 className="font-brand-serif text-lg font-medium text-white line-clamp-1 leading-snug drop-shadow-xs">
                        {store.name}
                      </h4>
                    </div>
                  </div>

                  {/* Card Footer Details */}
                  <div className="p-4 bg-white flex flex-col justify-between flex-1 space-y-3">
                    <p className="text-xs text-stone-600 line-clamp-1 font-light">
                      Specialty: <span className="text-stone-900 font-medium">{store.specialty}</span>
                    </p>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-xs">
                        <div>
                          <span className="text-[10px] text-stone-400 uppercase block font-semibold">Total Sales</span>
                          <span className="font-extrabold text-stone-900 text-xs">{store.salesCount}+</span>
                        </div>
                        <div className="h-6 w-[1px] bg-stone-200" />
                        <div>
                          <span className="text-[10px] text-stone-400 uppercase block font-semibold">Available</span>
                          <span className="font-extrabold text-stone-900 text-xs">{store.activeSuits} Suits</span>
                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center group-hover:bg-amber-600 transition-colors shadow-2xs">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
