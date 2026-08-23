import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TRENDING_TAB_CATEGORIES } from '@/data/mockData';
import { Product } from '@/types';
import { ChevronLeft, ChevronRight, ArrowRight, PackageOpen } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { fetchTrendingProductsByTab } from '@/src/api/collectionService';


interface MostTrendingProps {
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  wishlistIds: string[];
  onSelectProduct?: (product: Product) => void;
  onSelectReseller?: (resellerId: string) => void;
  onViewAll?: (category: string) => void;
}

export const MostTrending: React.FC<MostTrendingProps> = ({
  onQuickView,
  onAddToCart,
  onToggleWishlist,
  wishlistIds,
  onSelectProduct,
  onSelectReseller,
  onViewAll,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('NEW ARRIVALS');
  const [productsCache, setProductsCache] = useState<Record<string, Product[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTabProducts() {
      if (productsCache[activeTab]) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const fetched = await fetchTrendingProductsByTab(activeTab);

        if (isMounted) {
          setProductsCache((prev) => ({
            ...prev,
            [activeTab]: fetched || [],
          }));
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading tab products:', err);
        if (isMounted) {
          setProductsCache((prev) => ({
            ...prev,
            [activeTab]: [],
          }));
          setLoading(false);
        }
      }
    }

    loadTabProducts();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const currentProducts = productsCache[activeTab] || [];

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleViewAllClick = () => {
    let categoryParam = 'New Arrivals';
    const tabUpper = activeTab.toUpperCase().trim();
    if (tabUpper === 'UNSTITCHED') categoryParam = 'Unstitched';
    else if (tabUpper === 'LUXURY PRET') categoryParam = 'Luxury Pret';
    else if (tabUpper === 'BRIDAL WEAR' || tabUpper === 'BRIDAL') categoryParam = 'Bridal';
    else if (tabUpper === 'FORMALS' || tabUpper === 'FORMAL') categoryParam = 'Formals';

    if (onViewAll) {
      onViewAll(categoryParam);
    } else {
      router.push(`/shop?category=${encodeURIComponent(categoryParam)}`);
    }
  };

  const handleProductSelect = (product: Product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else {
      router.push(`/product/${product.id}`);
    }
  };

  return (
    <section className="py-12 md:py-16 bg-white overflow-hidden">
      {/* Top Header & Category Tabs */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 mb-8">
        <div className="flex items-center justify-between gap-3 sm:gap-5 border-b border-stone-200 pb-5">

          {/* Left Side - Heading */}
          <div className="min-w-0 shrink">
            <h2 className="font-brand-serif text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal text-stone-900 tracking-wide whitespace-nowrap">
              Most Trending Now
            </h2>

            <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-stone-500 mt-1 font-light tracking-wide truncate max-w-full">
              Curated Designer Leftovers
            </p>
          </div>

          {/* Right Side */}
          <div className="flex items-center justify-end gap-2 sm:gap-4 min-w-0 flex-1">

            {/* Scrollable Tabs */}
            <div className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5 overflow-x-auto no-scrollbar py-1 min-w-0">
              {TRENDING_TAB_CATEGORIES.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
        shrink-0
        whitespace-nowrap
        bg-transparent
        border-none
        text-[10px] sm:text-xs md:text-sm
        px-2 py-1.5
        sm:px-2.5 sm:py-2
        md:px-3
        transition-all duration-300
        ${activeTab === tab
                      ? 'font-extrabold text-stone-900 underline underline-offset-4 decoration-1 decoration-stone-300'
                      : 'font-medium text-stone-500 hover:text-stone-900'
                    }
      `}
                >
                  {tab}
                </button>
              ))}
            </div>


          </div>
        </div>
      </div>

      {/* Horizontal Product Cards Row */}
      <div className="max-w-[1920px] mx-auto pl-6 sm:pl-10 lg:pl-[40px] pr-4">
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pb-4 pt-1 w-full"
        >
          {loading && !productsCache[activeTab] ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                className="flex-none w-[200px] sm:w-[250px] md:w-[280px] xl:w-[310px] aspect-[3/4] bg-stone-100 animate-pulse rounded-xl"
              />
            ))
          ) : currentProducts.length === 0 ? (
            // No Products
            <div className="w-full flex flex-col items-center justify-center py-16 sm:py-20 text-center">
              {/* Empty State Icon */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-stone-100 flex items-center justify-center mb-5">
                <PackageOpen className="w-7 h-7 sm:w-8 sm:h-8 text-stone-400" />
              </div>

              {/* Title */}
              <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-wide mb-2">
                Oops!
              </h3>

              {/* Message */}
              <p className="text-xs sm:text-sm text-stone-500 font-light tracking-wide max-w-[280px] sm:max-w-[360px] leading-relaxed">
                This product is not available in this category right now.
              </p>
            </div>
          ) : (
            <>
              {currentProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex-none w-[200px] sm:w-[250px] md:w-[280px] xl:w-[310px]"
                >
                  <ProductCard
                    product={product}
                    onQuickView={onQuickView}
                    onAddToCart={onAddToCart}
                    onToggleWishlist={onToggleWishlist}
                    isWishlisted={wishlistIds.includes(product.id)}
                    onSelectProduct={handleProductSelect}
                    onSelectReseller={onSelectReseller}
                  />
                </div>
              ))}

              {/* View All Card */}
              <div className="flex-none w-[200px] sm:w-[250px] md:w-[280px] xl:w-[310px]">
                <div
                  onClick={handleViewAllClick}
                  className="group/viewall flex flex-col items-center justify-center h-full min-h-[350px] sm:min-h-[400px] text-white rounded-xl p-6 text-center cursor-pointer "
                >
                  <div className="w-12 h-12 rounded-full bg-stone-800 group-hover/viewall:bg-amber-400 group-hover/viewall:text-stone-950 text-amber-400 flex items-center justify-center mb-4 transition-all duration-300 transform group-hover/viewall:scale-110">
                    <ArrowRight className="w-6 h-6" />
                  </div>

                  <span className="text-[10px] sm:text-xs font-bold tracking-widest text-amber-400 uppercase mb-1">
                    EXPLORE COLLECTION
                  </span>

                  <h4 className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-white mb-2">
                    VIEW ALL
                  </h4>

                  <p className="text-[11px] sm:text-xs text-stone-400 max-w-[180px] font-medium leading-relaxed">
                    Browse all available {activeTab.toLowerCase()} stock
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

