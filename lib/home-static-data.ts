// SAMPLE DATA – replace with DB data later
// All prices, seller names, and product titles are fictional sample data.
// Images are from Pexels (free license, no attribution required).

// ============================================================================
// TYPES
// ============================================================================

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  image: string; // TODO(dynamic): will come from CMS/DB
  imageAlt: string;
}

export interface HomeCategory {
  id: string;
  slug: string;
  name: string;
  image: string; // TODO(dynamic): replace with category.image_url from DB
  imageAlt: string;
  href: string;
}

export interface HomeProduct {
  id: string;
  slug: string;
  title: string;
  price: number;
  image: string; // TODO(dynamic): replace with product_images[0].image_url
  imageAlt: string;
  sellerName: string;
  badge?: string;
}

export interface FeaturedSellerData {
  image: string; // TODO(dynamic): replace with seller.banner_url
  imageAlt: string;
  eyebrow: string;
  heading: string;
  paragraph: string;
  bullets: string[];
  cta: string;
  href: string;
}

export interface SellerStat {
  value: string;
  label: string;
}

// ============================================================================
// HELPER
// ============================================================================

export function formatPrice(price: number): string {
  return `Rs. ${price.toLocaleString('en-PK')}`;
}

// ============================================================================
// HERO SLIDES
// ============================================================================

export const heroSlides: HeroSlide[] = [
  {
    id: 'hero-1',
    eyebrow: '',
    title: 'Find Everything You Love in One Place',
    subtitle: 'Fashion, Tech, LIfestyle & More',
    cta: 'Start Shopping',
    href: '/shop',
    image: '/images/home/banner1.jpg', // TODO(dynamic)
    imageAlt: 'Zebaish Banner',
  },
  {
    id: 'hero-2',
    eyebrow: 'Fashion & Accessories',
    title: 'Explore Fashion & Accessories',
    subtitle: 'Curated collections from independent sellers nationwide.',
    cta: 'Shop Fashion',
    href: '/shop?category=Fashion',
    image: '/images/home/hero-2-fashion2.jpg', // TODO(dynamic)
    imageAlt: 'Modern fashion store interior with clothing racks',
  },
  {
    id: 'hero-3',
    eyebrow: 'Home & Garden',
    title: 'Upgrade Your Home',
    subtitle: 'Furniture, decor and garden essentials for every space.',
    cta: 'Shop Home & Garden',
    href: '/shop?category=Home+%26+Garden',
    image: '/images/home/hero-3-home.jpg', // TODO(dynamic)
    imageAlt: 'Bright living room with furniture and plants',
  },
];

// ============================================================================
// SHOP BY CATEGORY
// ============================================================================

export const homeCategories: HomeCategory[] = [
  {
    id: 'cat-1',
    slug: 'fashion',
    name: 'Fashion',
    image: '/images/home/c1.jpg', // TODO(dynamic)
    imageAlt: 'Fashion — garments on display in a boutique',
    href: '/shop?category=Fashion',
  },
  {
    id: 'cat-2',
    slug: 'home-garden',
    name: 'Home & Garden',
    image: '/images/home/cat-home-garden.jpg', // TODO(dynamic)
    imageAlt: 'Home & Garden — modern living space with greenery',
    href: '/shop?category=Home+%26+Garden',
  },
  {
    id: 'cat-3',
    slug: 'electronics',
    name: 'Electronics',
    image: '/images/home/cat-electronics.jpg', // TODO(dynamic)
    imageAlt: 'Electronics — headphones beside a laptop',
    href: '/shop?category=Electronics',
  },
  {
    id: 'cat-4',
    slug: 'health-beauty',
    name: 'Health & Beauty',
    image: '/images/home/cat-health-beauty.jpg', // TODO(dynamic)
    imageAlt: 'Health & Beauty — beauty creams in bottles',
    href: '/shop?category=Health+%26+Beauty',
  },
  {
    id: 'cat-5',
    slug: 'sports-outdoors',
    name: 'Sports & Outdoors',
    image: '/images/home/cat-sports-outdoors.jpg', // TODO(dynamic)
    imageAlt: 'Sports & Outdoors — running shoes with smartwatch',
    href: '/shop?category=Sports+%26+Outdoors',
  },
  {
    id: 'cat-6',
    slug: 'industrial',
    name: 'Industrial & Business Equipment',
    image: '/images/home/cat-industrial.jpg', // TODO(dynamic)
    imageAlt: 'Industrial & Business Equipment — factory floor with machinery',
    href: '/shop?category=Industrial+%26+Business+Equipment',
  },
];

// ============================================================================
// TRENDING PRODUCTS
// ============================================================================

export const trendingProducts: HomeProduct[] = [
  // TODO(dynamic): fetch from products table ordered by views/sales
  { id: 'tp-1', slug: 'classic-street-sneakers', title: 'Classic Street Sneakers', price: 5499, image: '/images/home/trend-1.jpg', imageAlt: 'Classic street sneakers side view', sellerName: 'Peak Sports PK' },
  { id: 'tp-2', slug: 'leather-everyday-handbag', title: 'Leather Everyday Handbag', price: 7200, image: '/images/home/trend-2.jpg', imageAlt: 'Brown leather handbag close-up', sellerName: 'Lahore Leather Co.' },
  { id: 'tp-3', slug: 'analog-dress-watch', title: 'Analog Dress Watch', price: 12500, image: '/images/home/trend-3.jpg', imageAlt: 'Analog dress watch on wrist', sellerName: 'TechNest' },
  { id: 'tp-4', slug: 'signature-eau-de-parfum', title: 'Signature Eau de Parfum', price: 4800, image: '/images/home/trend-4.jpg', imageAlt: 'Glass perfume bottle on marble surface', sellerName: 'Glow Corner' },
  { id: 'tp-5', slug: 'black-frame-sunglasses', title: 'Black Frame Sunglasses', price: 1899, image: '/images/home/trend-5.jpg', imageAlt: 'Black frame sunglasses on white background', sellerName: 'Noor Atelier' },
  { id: 'tp-6', slug: 'glow-skincare-set', title: 'Glow Skincare Set', price: 3200, image: '/images/home/trend-6.jpg', imageAlt: 'Skincare bottles and jars arranged neatly', sellerName: 'Glow Corner' },
  { id: 'tp-7', slug: 'ceramic-vase-table-lamp', title: 'Ceramic Vase & Table Lamp', price: 6750, image: '/images/home/trend-7.jpg', imageAlt: 'Ceramic vase and table lamp on shelf', sellerName: 'Karachi Home Studio' },
  { id: 'tp-8', slug: 'lightweight-training-shoes', title: 'Lightweight Training Shoes', price: 4300, image: '/images/home/trend-8.jpg', imageAlt: 'Lightweight training shoes close-up', sellerName: 'Peak Sports PK' },
];

// ============================================================================
// NEW ARRIVALS
// ============================================================================

export type NewArrivalCategory = 'Fashion' | 'Home & Garden' | 'Electronics' | 'Health & Beauty';

export const newArrivalsByCategory: Record<NewArrivalCategory, HomeProduct[]> = {
  Fashion: [
    { id: 'naf-1', slug: 'handcrafted-leather-bag', title: 'Handcrafted Leather Bag', price: 8500, image: '/images/home/new-1.jpg', imageAlt: 'Handcrafted brown leather bag', sellerName: 'Lahore Leather Co.', badge: 'New' },
    { id: 'naf-2', slug: 'minimal-silver-wristwatch', title: 'Minimal Silver Wristwatch', price: 18500, image: '/images/home/new-2.jpg', imageAlt: 'Minimal silver wristwatch on display', sellerName: 'TechNest', badge: 'New' },
    { id: 'naf-3', slug: 'everyday-canvas-sneakers', title: 'Everyday Canvas Sneakers', price: 3500, image: '/images/home/new-6.jpg', imageAlt: 'Canvas sneakers on wooden floor', sellerName: 'Peak Sports PK', badge: 'New' },
    { id: 'naf-4', slug: 'summer-sunglasses-assortment', title: 'Summer Sunglasses Assortment', price: 2100, image: '/images/home/new-8.jpg', imageAlt: 'Assortment of summer sunglasses on display', sellerName: 'Noor Atelier', badge: 'New' },
    { id: 'naf-5', slug: 'classic-street-sneakers', title: 'Classic Street Sneakers', price: 5499, image: '/images/home/trend-1.jpg', imageAlt: 'Classic street sneakers side view', sellerName: 'Peak Sports PK', badge: 'New' },
    { id: 'naf-6', slug: 'leather-everyday-handbag', title: 'Leather Everyday Handbag', price: 7200, image: '/images/home/trend-2.jpg', imageAlt: 'Brown leather handbag close-up', sellerName: 'Lahore Leather Co.', badge: 'New' },
    { id: 'naf-7', slug: 'analog-dress-watch', title: 'Analog Dress Watch', price: 12500, image: '/images/home/trend-3.jpg', imageAlt: 'Analog dress watch on wrist', sellerName: 'TechNest', badge: 'New' },
    { id: 'naf-8', slug: 'black-frame-sunglasses', title: 'Black Frame Sunglasses', price: 1899, image: '/images/home/trend-5.jpg', imageAlt: 'Black frame sunglasses on white background', sellerName: 'Noor Atelier', badge: 'New' },
  ],
  'Home & Garden': [
    { id: 'nah-1', slug: 'indoor-plant-table-decor', title: 'Indoor Plant Table Decor', price: 1200, image: '/images/home/new-7.jpg', imageAlt: 'Green indoor plant on a wooden table', sellerName: 'Karachi Home Studio', badge: 'New' },
    { id: 'nah-2', slug: 'ceramic-vase-table-lamp', title: 'Ceramic Vase & Table Lamp', price: 6750, image: '/images/home/trend-7.jpg', imageAlt: 'Ceramic vase and table lamp on shelf', sellerName: 'Karachi Home Studio', badge: 'New' },
    { id: 'nah-3', slug: 'modern-living-accent-cushion', title: 'Modern Living Accent Cushion Set', price: 3200, image: '/images/home/hero-3-home.jpg', imageAlt: 'Living room with furniture and plants', sellerName: 'Karachi Home Studio', badge: 'New' },
    { id: 'nah-4', slug: 'minimalist-ceramic-planter', title: 'Minimalist Ceramic Planter', price: 2450, image: '/images/home/cat-home-garden.jpg', imageAlt: 'Modern living space with greenery', sellerName: 'Green Space PK', badge: 'New' },
    { id: 'nah-5', slug: 'handcrafted-wooden-shelf', title: 'Handcrafted Wooden Shelf Decor', price: 4800, image: '/images/home/new-7.jpg', imageAlt: 'Indoor plant and table decor', sellerName: 'Lahore Craft Studio', badge: 'New' },
    { id: 'nah-6', slug: 'ambient-bedside-table-lamp', title: 'Ambient Bedside Table Lamp', price: 5900, image: '/images/home/trend-7.jpg', imageAlt: 'Ceramic lamp on shelf', sellerName: 'Karachi Home Studio', badge: 'New' },
    { id: 'nah-7', slug: 'botanical-succulent-trio', title: 'Botanical Succulent Plant Trio', price: 1750, image: '/images/home/cat-home-garden.jpg', imageAlt: 'Living space with indoor greenery', sellerName: 'Green Space PK', badge: 'New' },
    { id: 'nah-8', slug: 'natural-woven-storage-basket', title: 'Natural Woven Storage Basket', price: 2600, image: '/images/home/hero-3-home.jpg', imageAlt: 'Living room decor accent', sellerName: 'Lahore Craft Studio', badge: 'New' },
  ],
  Electronics: [
    { id: 'nae-1', slug: 'wireless-overear-headphones', title: 'Wireless Over-Ear Headphones', price: 12900, image: '/images/home/cat-electronics.jpg', imageAlt: 'Headphones beside laptop', sellerName: 'SoundTech PK', badge: 'New' },
    { id: 'nae-2', slug: 'minimalist-silver-smartwatch', title: 'Minimalist Silver Smartwatch', price: 18500, image: '/images/home/new-2.jpg', imageAlt: 'Silver smartwatch on display', sellerName: 'TechNest', badge: 'New' },
    { id: 'nae-3', slug: 'portable-desk-bluetooth-speaker', title: 'Portable Desk Bluetooth Speaker', price: 5400, image: '/images/home/hero-4-electronics.jpg', imageAlt: 'Electronic gadgets flat lay', sellerName: 'SoundTech PK', badge: 'New' },
    { id: 'nae-4', slug: 'sports-fitness-tracking-band', title: 'Sports Fitness Tracking Band', price: 4200, image: '/images/home/cat-sports-outdoors.jpg', imageAlt: 'Smartwatch running gear', sellerName: 'VoltStore', badge: 'New' },
    { id: 'nae-5', slug: 'multiport-fast-charger-65w', title: 'Multiport Fast GaN Charger 65W', price: 3100, image: '/images/home/hero-4-electronics.jpg', imageAlt: 'Modern electronics accessories', sellerName: 'VoltStore', badge: 'New' },
    { id: 'nae-6', slug: 'precision-wireless-mouse', title: 'Precision Slim Wireless Mouse', price: 2800, image: '/images/home/cat-electronics.jpg', imageAlt: 'Headphones and laptop work setup', sellerName: 'TechNest', badge: 'New' },
    { id: 'nae-7', slug: 'smart-desk-digital-clock', title: 'Smart Desk Digital Clock', price: 3850, image: '/images/home/new-2.jpg', imageAlt: 'Minimal wristwatch and gadget', sellerName: 'GadgetHub', badge: 'New' },
    { id: 'nae-8', slug: 'dual-driver-in-ear-earphones', title: 'Dual-Driver In-Ear Earphones', price: 4600, image: '/images/home/hero-4-electronics.jpg', imageAlt: 'Electronic gadget collection', sellerName: 'SoundTech PK', badge: 'New' },
  ],
  'Health & Beauty': [
    { id: 'nahb-1', slug: 'minimalist-perfume-bottle', title: 'Minimalist Perfume Bottle', price: 3900, image: '/images/home/new-3.jpg', imageAlt: 'Minimalist perfume bottle with soft shadows', sellerName: 'Glow Corner', badge: 'New' },
    { id: 'nahb-2', slug: 'beauty-serum-collection', title: 'Beauty Serum Collection', price: 2800, image: '/images/home/new-4.jpg', imageAlt: 'Collection of beauty serums in glass bottles', sellerName: 'Glow Corner', badge: 'New' },
    { id: 'nahb-3', slug: 'luxury-fragrance-50ml', title: 'Luxury Fragrance 50ml', price: 6200, image: '/images/home/new-5.jpg', imageAlt: 'Luxury fragrance bottle against dark background', sellerName: 'Noor Atelier', badge: 'New' },
    { id: 'nahb-4', slug: 'glow-skincare-set', title: 'Glow Skincare Essential Set', price: 3200, image: '/images/home/trend-6.jpg', imageAlt: 'Skincare bottles and jars arranged neatly', sellerName: 'Glow Corner', badge: 'New' },
    { id: 'nahb-5', slug: 'signature-eau-de-parfum', title: 'Signature Eau de Parfum', price: 4800, image: '/images/home/trend-4.jpg', imageAlt: 'Glass perfume bottle on marble surface', sellerName: 'Glow Corner', badge: 'New' },
    { id: 'nahb-6', slug: 'nourishing-herbal-cream', title: 'Nourishing Herbal Day Cream', price: 2150, image: '/images/home/cat-health-beauty.jpg', imageAlt: 'Beauty creams in bottles', sellerName: 'PureBotanics', badge: 'New' },
    { id: 'nahb-7', slug: 'revitalizing-facial-oil', title: 'Revitalizing Pure Facial Oil', price: 2900, image: '/images/home/new-4.jpg', imageAlt: 'Glass serum bottle close-up', sellerName: 'PureBotanics', badge: 'New' },
    { id: 'nahb-8', slug: 'velvet-matte-liquid-lipstick', title: 'Velvet Matte Liquid Lipstick', price: 1850, image: '/images/home/new-5.jpg', imageAlt: 'Luxury cosmetic product', sellerName: 'Noor Atelier', badge: 'New' },
  ],
};

// Default export kept for backwards compatibility
export const newArrivals: HomeProduct[] = newArrivalsByCategory.Fashion;

// ============================================================================
// FEATURED SELLERS
// ============================================================================

export const featuredSeller: FeaturedSellerData = {
  // TODO(dynamic): fetch from sellers table, featured = true
  image: '/images/home/featured-seller2.jpg',
  imageAlt: 'Seller packing customer orders at a table',
  eyebrow: 'Featured Sellers',
  heading: 'Shop directly from Pakistan\'s independent sellers',
  paragraph: 'Zebaish is a marketplace of dedicated seller stores. Browse unique products from sellers across Pakistan — each with their own store, their own inventory, and their own story.',
  bullets: [
    'Dedicated seller stores',
    'Products from across Pakistan',
    'Shop by store, not just by product',
  ],
  cta: 'Explore Stores',
  href: '/shop',
};

// ============================================================================
// SELLER STATS (Become a Seller section)
// ============================================================================

export const sellerStats: SellerStat[] = [
  { value: '200+', label: 'sellers registered with us' },
];

export const sellerBenefits: string[] = [
  'Your own dedicated store',
  'Easy product & variation management',
  'Reach customers nationwide',
];

