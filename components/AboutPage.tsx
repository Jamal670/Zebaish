'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  Store,
  Tag,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  PackageCheck,
  Users,
  Search,
  Eye,
  Award
} from 'lucide-react';

import sellerBoutiqueImage from '@/src/assets/images/seller_boutique_partner_1784730609664.jpg';
import showroomImage from '@/src/assets/images/top_stores_showroom_1784731726898.jpg';
import mastaniBanner from '@/src/assets/images/campaign_mastani_bg_1784669097184.jpg';

// Helper interface for Feature Card
interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, description }) => (
  <div className="bg-white p-6 sm:p-7 rounded-lg border border-stone-200 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
    <div>
      <div className="w-10 h-10 sm:w-11 sm:h-11 bg-stone-900 text-white rounded-xs flex items-center justify-center mb-4 shrink-0 shadow-xs">
        <Icon className="w-5 h-5 text-amber-400" />
      </div>
      <h3 className="font-bold text-stone-900 text-sm sm:text-base uppercase tracking-wider mb-2">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);

// Helper interface for Process Step
interface ProcessStepProps {
  number: string;
  title: string;
  description: string;
}

const ProcessStep: React.FC<ProcessStepProps> = ({ number, title, description }) => (
  <div className="bg-white p-6 sm:p-7 rounded-lg border border-stone-200 shadow-2xs relative flex flex-col justify-between">
    <div>
      <span className="font-brand-serif text-2xl sm:text-3xl font-bold text-amber-600 block mb-2">
        {number}
      </span>
      <h3 className="font-bold text-stone-900 text-sm sm:text-base uppercase tracking-wider mb-2">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);

export const AboutPage: React.FC = () => {
  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 animate-fade-in pb-16 sm:pb-24">
      {/* 1. HERO SECTION */}
      <div className="relative bg-stone-900 text-white overflow-hidden py-16 sm:py-24 lg:py-28 px-4 md:px-8 border-b border-stone-800">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay">
          <Image
            src={mastaniBanner}
            alt="Zebaish Designer Surplus Fashion"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="relative max-w-7xl mx-auto text-center space-y-4">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.3em] text-amber-400 uppercase block">
            ABOUT ZEBAISH
          </span>
          <h1 className="font-brand-serif text-3xl sm:text-4xl lg:text-5xl font-normal uppercase tracking-wider max-w-4xl mx-auto leading-tight">
            Where Designer Fashion Finds a New Home.
          </h1>
          <p className="text-stone-300 text-xs sm:text-sm lg:text-base max-w-2xl mx-auto leading-relaxed pt-2">
            Zebaish connects discerning fashion lovers with authentic designer surplus, clearance overstocks, and leftover suit collections directly from verified sellers across Pakistan.
          </p>
          <div className="pt-6">
            <Link
              href="/shop"
              className="inline-flex items-center space-x-2 px-6 sm:px-8 py-3 bg-white hover:bg-stone-100 text-stone-950 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. WHO WE ARE */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 sm:py-16 lg:py-20 border-b border-stone-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-600 uppercase block">
              OUR IDENTITY
            </span>
            <h2 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 uppercase tracking-wider">
              REDEFINING THE SURPLUS MARKETPLACE
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Zebaish was founded on a simple realization: high-quality designer suits and premium textile overstocks should not sit idle in warehouse inventory. Across Pakistan, top boutiques and reseller partners hold authentic, unstitched lawn, luxury pret, and bridal surplus that deserves a second life.
            </p>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              We built Zebaish as a dedicated multi-vendor marketplace where independent boutique sellers get a professional storefront, and customers gain direct access to curated surplus collections at honest, accessible prices.
            </p>
          </div>
          <div className="lg:col-span-6 relative h-64 sm:h-80 lg:h-96 rounded-lg overflow-hidden border border-stone-200 shadow-md">
            <Image
              src={showroomImage}
              alt="Zebaish Showroom & Partner Boutique"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>

      {/* 3. OUR MISSION */}
      <div className="bg-white py-12 sm:py-16 lg:py-20 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-600 uppercase block mb-1">
              PURPOSE & PURPOSE
            </span>
            <h2 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 uppercase tracking-wider">
              OUR MISSION & VALUES
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-widest block">01. ACCESSIBILITY</span>
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Designer Fashion for All</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Making original Pakistani designer surplus and leftovers accessible to shoppers nationwide at honest prices.
              </p>
            </div>

            <div className="p-6 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-widest block">02. TRUSTED SELLERS</span>
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Empowering Boutiques</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Providing independent reseller partners with a dedicated digital platform to showcase their surplus inventory.
              </p>
            </div>

            <div className="p-6 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-widest block">03. SUSTAINABLE FASHION</span>
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Recirculating Surplus</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Reducing textile clearance waste by ensuring every overstock suit and leftover piece finds a happy buyer.
              </p>
            </div>

            <div className="p-6 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-widest block">04. SEAMLESS DISCOVERY</span>
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Multi-Brand Catalog</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Bringing multi-brand leftover collections into one searchable, easy-to-filter catalog for effortless shopping.
              </p>
            </div>

            <div className="p-6 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-widest block">05. TRANSPARENCY</span>
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Clear Specifications</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Providing exact fabric compositions, piece count details, defect disclosures, and original vs. surplus prices.
              </p>
            </div>

            <div className="p-6 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-widest block">06. LOW-FRICTION SELLING</span>
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Streamlined Onboarding</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Enabling sellers to list products, manage inventory, and fulfill orders with minimal administrative friction.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. WHY ZEBAISH (EXACTLY 5 FEATURE CARDS) */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 sm:py-16 lg:py-20 border-b border-stone-200">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-600 uppercase block mb-1">
            ADVANTAGES
          </span>
          <h2 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 uppercase tracking-wider">
            WHY CHOOSE ZEBAISH
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <FeatureCard
            icon={ShieldCheck}
            title="Authentic Finds"
            description="Sourced directly from clearance surplus and brand overstocks across Pakistan."
          />
          <FeatureCard
            icon={Store}
            title="Verified Sellers"
            description="Independent boutique partners with visible store profiles, ratings, and metrics."
          />
          <FeatureCard
            icon={Tag}
            title="Better Value"
            description="Factory surplus prices offering exceptional savings on original designer suits."
          />
          <FeatureCard
            icon={Sparkles}
            title="Unique Collections"
            description="Rare unstitched, pret, and luxury formal pieces not easily found in standard retail."
          />
          <FeatureCard
            icon={ShoppingBag}
            title="Simple Shopping"
            description="Direct checkout, order tracking, transparent item details, and dedicated support."
          />
        </div>
      </div>

      {/* 5. HOW ZEBAISH WORKS (4-STEP PROCESS) */}
      <div className="bg-white py-12 sm:py-16 lg:py-20 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-600 uppercase block mb-1">
              SIMPLE PROCESS
            </span>
            <h2 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 uppercase tracking-wider">
              HOW ZEBAISH WORKS
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ProcessStep
              number="01."
              title="Discover"
              description="Browse thousands of surplus suits, unstitched lawn, and pret collections across top designer brands."
            />
            <ProcessStep
              number="02."
              title="Explore"
              description="Inspect detailed seller store details, fabric compositions, defect notes, and customer reviews."
            />
            <ProcessStep
              number="03."
              title="Choose"
              description="Select your preferred suit size, piece count, or unstitched variant with real-time stock availability."
            />
            <ProcessStep
              number="04."
              title="Order"
              description="Place your order securely with dispatches directly from verified reseller storefronts."
            />
          </div>
        </div>
      </div>

      {/* 6. FOR CUSTOMERS */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 sm:py-16 lg:py-20 border-b border-stone-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-600 uppercase block">
              FOR SHOPPERS
            </span>
            <h2 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 uppercase tracking-wider">
              A BETTER WAY TO SHOP SURPLUS
            </h2>
            <ul className="space-y-3 text-xs sm:text-sm text-stone-700">
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Multi-brand discovery across top Pakistani designer leftover collections.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Detailed product specifications including fabric, piece count, and defect disclosures.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Transparent seller store profiles with response times and ratings.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Verified buyer reviews and rating breakdowns.</span>
              </li>
            </ul>
            <div className="pt-3">
              <Link
                href="/shop"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <span>SHOP THE COLLECTION</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="lg:col-span-6 relative h-64 sm:h-80 rounded-lg overflow-hidden border border-stone-200 shadow-md">
            <Image
              src={showroomImage}
              alt="Shop Surplus Collections"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>

      {/* 7. FOR SELLERS */}
      <div className="bg-white py-12 sm:py-16 lg:py-20 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1 relative h-64 sm:h-80 rounded-lg overflow-hidden border border-stone-200 shadow-md">
              <Image
                src={sellerBoutiqueImage}
                alt="Become a Seller Partner on Zebaish"
                fill
                className="object-cover"
              />
            </div>
            <div className="lg:col-span-6 order-1 lg:order-2 space-y-5">
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-600 uppercase block">
                FOR BOUTIQUES & RESELLERS
              </span>
              <h2 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 uppercase tracking-wider">
                GROW YOUR SURPLUS STORE ON ZEBAISH
              </h2>
              <ul className="space-y-3 text-xs sm:text-sm text-stone-700">
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Dedicated store management & customized shop branding.</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Effortless product listing, image uploads, and size/variant quantity tracking.</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Direct order management dashboard and customer fulfillment updates.</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Reach fashion-conscious buyers across Pakistan looking for surplus collections.</span>
                </li>
              </ul>
              <div className="pt-3">
                <Link
                  href="/reseller/signup"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-amber-400 text-stone-950 hover:bg-amber-300 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <span>BECOME A SELLER</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 8. BUILT AROUND TRUST */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 sm:py-16 lg:py-20 border-b border-stone-200">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-600 uppercase block mb-1">
            TRANSPARENCY & CLARITY
          </span>
          <h2 className="font-brand-serif text-2xl sm:text-3xl font-normal text-stone-900 uppercase tracking-wider">
            BUILT AROUND TRUST
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-lg border border-stone-200 shadow-2xs space-y-2">
            <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Seller Profile Visibility</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Every seller profile displays store names, city locations, response metrics, and active suit listings.
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg border border-stone-200 shadow-2xs space-y-2">
            <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Product Attribute Detail</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Clear item descriptions including fabric, piece counts, color codes, and any defect disclosures.
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg border border-stone-200 shadow-2xs space-y-2">
            <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Verified Buyer Reviews</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Customer ratings and reviews attached directly to products and seller storefronts.
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg border border-stone-200 shadow-2xs space-y-2">
            <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Transparent Pricing</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Original retail prices and surplus selling prices clearly presented with discount calculations.
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg border border-stone-200 shadow-2xs space-y-2">
            <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Order Status Visibility</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Real-time order status updates (Order Placed, Shipped, Delivered) with courier tracking info when available.
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg border border-stone-200 shadow-2xs space-y-2">
            <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Dedicated Support</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Customer support assistance for order inquiries, returns, and seller onboarding.
            </p>
          </div>
        </div>
      </div>

      {/* 9. BRAND PHILOSOPHY */}
      <div className="bg-stone-900 text-white py-14 sm:py-18 lg:py-24 px-4 md:px-8 border-b border-stone-800 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.3em] text-amber-400 uppercase block">
            OUR PHILOSOPHY
          </span>
          <h2 className="font-brand-serif text-2xl sm:text-3xl lg:text-4xl font-normal uppercase tracking-wider">
            Style Should Not Go To Waste.
          </h2>
          <p className="text-stone-300 text-xs sm:text-sm lg:text-base leading-relaxed max-w-2xl mx-auto pt-2">
            We believe exceptional textile craftsmanship and original designer fashion deserve to be worn, celebrated, and cherished—never left behind in warehouse inventory. Zebaish bridges the gap between surplus fashion and mindful style.
          </p>
        </div>
      </div>

      {/* 10. FINAL CTA */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-12 sm:pt-16 lg:pt-20 text-center">
        <div className="bg-white p-8 sm:p-12 lg:p-16 rounded-lg border border-stone-200 shadow-sm space-y-4 max-w-4xl mx-auto">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-600 uppercase block">
            GET STARTED TODAY
          </span>
          <h2 className="font-brand-serif text-2xl sm:text-3xl lg:text-4xl font-normal text-stone-900 uppercase tracking-wider">
            DISCOVER SOMETHING DIFFERENT
          </h2>
          <p className="text-stone-600 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
            Join thousands of fashion lovers and verified sellers on Pakistan's premier designer surplus marketplace.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/shop"
              className="w-full sm:w-auto px-8 py-3.5 bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xs shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              SHOP NOW
            </Link>
            <Link
              href="/reseller/signup"
              className="w-full sm:w-auto px-8 py-3.5 bg-amber-400 text-stone-950 hover:bg-amber-300 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xs shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              BECOME A SELLER
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
