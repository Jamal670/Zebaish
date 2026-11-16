import React from 'react';
import { HeroCarousel } from '@/components/HeroCarousel';
import { ShopByCategory } from '@/components/home/ShopByCategory';
import { TrendingProducts } from '@/components/home/TrendingProducts';
import { NewArrivals } from '@/components/home/NewArrivals';
import { FeaturedSellers } from '@/components/home/FeaturedSellers';
import { BecomeSeller } from '@/components/home/BecomeSeller';
import { Newsletter } from '@/components/home/Newsletter';

export default function HomePage() {
  return (
    <>
      {/* 1. Hero Carousel */}
      <HeroCarousel />

      {/* 2. Shop by Category (6 core categories) */}
      <ShopByCategory />

      {/* Future: <TodaysDeals /> goes after ShopByCategory */}

      {/* 3. Trending Products (8 portrait products) */}
      {/* <TrendingProducts /> */}

      {/* 4. New Arrivals (8 portrait products) */}
      <NewArrivals />

      {/* 5. Featured Sellers (Split-layout feature block) */}
      <FeaturedSellers />

      {/* 6. Become a Seller (High-contrast CTA banner) */}
      <BecomeSeller />

      {/* 7. Newsletter (UI only) */}
      <Newsletter />
    </>
  );
}
