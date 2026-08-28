import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import sellerBoutiquePartner from '@/src/assets/images/seller_boutique_partner_1784730609664.jpg';

interface ShopByCollectionProps {
  onBecomeSellerClick?: () => void;
  onShopClick?: () => void;
}

export const ShopByCollection: React.FC<ShopByCollectionProps> = ({
  onBecomeSellerClick,
  onShopClick,
}) => {
  const router = useRouter();

  const handleClick = () => {
    if (onBecomeSellerClick) {
      onBecomeSellerClick();
    } else if (onShopClick) {
      onShopClick();
    } else {
      router.push('/dashboard');
    }
  };

  const imageSrc = typeof sellerBoutiquePartner === 'string' ? sellerBoutiquePartner : (sellerBoutiquePartner as any).src || sellerBoutiquePartner;

  return (
    <section className="py-10 md:py-14 bg-white">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-[40px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          
          {/* Left Text Box */}
          <div className="lg:col-span-4 bg-[#f9f9f9] border border-stone-100 rounded-xl p-8 md:p-12 flex flex-col justify-between">
            <div>
              <span className="text-2xs font-semibold tracking-[0.2em] text-amber-700 uppercase block mb-3">
                Grow your business
              </span>
              <h2 className="font-brand-serif text-3xl sm:text-4xl font-normal text-stone-900 tracking-wide mb-6 leading-tight">
                Join 200+ Verified Sellers Nationwide
              </h2>

              {/* Key Seller Benefits */}
              <div className="space-y-3 mb-8 text-xs sm:text-sm text-stone-700">
                <div className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-2" />
                  <span><strong>90-95% Profit Margins</strong> on authentic brand leftovers</span>
                </div>
                <div className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-2" />
                  <span><strong>Doorstep TCS Courier Pickup</strong> & automated tracking</span>
                </div>
                <div className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-2" />
                  <span><strong>Verified Badge</strong> & direct bank payouts</span>
                </div>
              </div>
              
              <button
                onClick={handleClick}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-stone-900 text-white hover:bg-black transition-all rounded-none text-xs font-semibold tracking-wider uppercase group shadow-2xs cursor-pointer"
              >
                <span>BECOME A SELLER</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-amber-400" />
              </button>
            </div>

            {/* Pagination Dash Lines */}
            <div className="mt-8 flex items-center space-x-2">
              <span className="w-8 h-[2px] bg-amber-600" />
              <span className="w-6 h-[2px] bg-stone-300" />
              <span className="w-6 h-[2px] bg-stone-300" />
            </div>
          </div>

          {/* Right Large Campaign Feature Photo */}
          <div className="lg:col-span-8 relative min-h-[380px] sm:min-h-[480px] lg:min-h-[520px] rounded-xl overflow-hidden bg-stone-900 group">
            <img
              src={imageSrc}
              alt="Become a Verified Surplus Reseller"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
            />
          </div>

        </div>
      </div>
    </section>
  );
};
