'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { HeroCarousel } from '@/components/HeroCarousel';
import { NewArrivalsCategories } from '@/components/NewArrivalsCategories';
import { FeaturedCollectionsGrid } from '@/components/FeaturedCollectionsGrid';
import { MostTrending } from '@/components/MostTrending';
import { ShopByCollection } from '@/components/ShopByCollection';
import { CoutureSection } from '@/components/CoutureSection';
import { WornAndLoved } from '@/components/WornAndLoved';
import { Newsletter } from '@/components/Newsletter';
import { useApp } from '@/components/context/AppContext';
import { Product } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const {
    setQuickViewProduct,
    handleAddToCart,
    handleToggleWishlist,
    wishlistIds,
  } = useApp();

  const handleNavigateShop = (brandOrCat?: string) => {
    if (brandOrCat) {
      const lower = brandOrCat.toLowerCase();
      if (
        lower.includes('khaadi') ||
        lower.includes('sapphire') ||
        lower.includes('gul ahmed') ||
        lower.includes('maria b') ||
        lower.includes('alkaram') ||
        lower.includes('bareeze') ||
        lower.includes('limelight') ||
        lower.includes('ethnic')
      ) {
        router.push(
          `/shop?brand=${encodeURIComponent(brandOrCat)}&category=${encodeURIComponent(
            `${brandOrCat.toUpperCase()} LEFTOVER SUITS`
          )}`
        );
      } else {
        router.push(`/shop?category=${encodeURIComponent(brandOrCat)}`);
      }
    } else {
      router.push('/shop');
    }
  };

  const handleSelectProduct = (product: Product) => {
    router.push(`/product/${product.id}`);
  };

  const handleSelectReseller = (resellerId: string) => {
    router.push(`/store/${resellerId}`);
  };

  const handleNavigateReseller = (page: 'signup' | 'login' | 'dashboard') => {
    router.push(`/${page}`);
  };

  return (
    <>
      <HeroCarousel />
      <NewArrivalsCategories onSelectCategory={handleNavigateShop} />
      <FeaturedCollectionsGrid onSelectCategory={handleNavigateShop} />
      <MostTrending
        onQuickView={(product) => setQuickViewProduct(product)}
        onAddToCart={(product) => handleAddToCart(product)}
        onToggleWishlist={handleToggleWishlist}
        wishlistIds={wishlistIds}
        onSelectProduct={handleSelectProduct}
        onSelectReseller={handleSelectReseller}
      />
      <ShopByCollection
        onBecomeSellerClick={() => handleNavigateReseller('dashboard')}
        onShopClick={() => handleNavigateReseller('dashboard')}
      />
      <CoutureSection
        onQuickView={(product) => setQuickViewProduct(product)}
        onAddToCart={(product) => handleAddToCart(product)}
        onToggleWishlist={handleToggleWishlist}
        wishlistIds={wishlistIds}
        onSelectProduct={handleSelectProduct}
        onSelectReseller={handleSelectReseller}
      />
      <WornAndLoved
        onShopNowClick={(ugc) => handleNavigateShop(ugc.tag || 'Lawn')}
      />
      <Newsletter />
    </>
  );
}
