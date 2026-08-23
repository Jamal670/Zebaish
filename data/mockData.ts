import { Product, Reseller, Review, Order, UGCItem, CategoryCard } from '@/types';

// Asset Image Imports
import heroZibaish from '@/src/assets/images/hero_zibaish_1784666632437.jpg';
import heroNafasat from '@/src/assets/images/hero_nafasat_1784666696363.jpg';
import heroRiwayatiHusn from '@/src/assets/images/hero_riwayati_husn_1784666650670.jpg';
import heroRonak from '@/src/assets/images/hero_ronaq_1784666668739.jpg';
import heroClassic from '@/src/assets/images/hero_classic_1784666682016.jpg';

import campaignMastaniBg from '@/src/assets/images/campaign_mastani_bg_1784669097184.jpg';

import catUnstitchedLawn from '@/src/assets/images/cat_unstitched_lawn_1784668900458.jpg';
import prodPretKurti from '@/src/assets/images/prod_pret_kurti_1784669264016.jpg';
import catLuxuryFormals from '@/src/assets/images/cat_luxury_pret_1784668945182.jpg';
import calloutRtw from '@/src/assets/images/callout_rtw_1784669029753.jpg';
import BagAccess from '@/src/assets/images/back.png';

import campaignMastaniPortrait from '@/src/assets/images/campaign_mastani_portrait_1784669111434.jpg';
import coutureMerjan from '@/src/assets/images/couture_merjan_1784669229241.jpg';

import first from '@/src/assets/images/callout_unstitched_1784669045779.jpg';
import second from '@/src/assets/images/prod_rawsilk_peacock_1784669181500.jpg';
import third from '@/src/assets/images/prod_lawn_crimson_1784669131773.jpg';
import fourth from '@/src/assets/images/prod_organza_lilac_1784669279327.jpg';
import fifth from '@/src/assets/images/couture_merjan_1784669229241.jpg';
import sixth from '@/src/assets/images/prod_rawsilk_maroon_1784669163942.jpg';



export const BRANDS: string[] = [
  'Sana Safinaz',
  'Maria B',
  'Khaadi',
  'Gul Ahmed',
  'Bareeze',
  'Asim Jofa',
  'Elan',
  'Zaha',
  'Sapphire',
  'Nishat Linen',
];

export const MOCK_RESELLERS: Reseller[] = [
  {
    id: 'reseller-1',
    name: 'Ayesha Khan',
    shopName: 'Ayesha Luxury Leftovers',
    logo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=250&auto=format&fit=crop',
    banner: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
    rating: 4.9,
    reviewCount: 128,
    responseTime: 'Replies in 15 mins',
    description: 'Authentic 100% original designer leftover suits directly sourced from factory overstocks. Unstitched & Luxury Pret.',
    joinedDate: 'Jan 2024',
    status: 'Active Seller',
    totalSales: 450,
    city: 'Lahore',
    activeListingsCount: 32,
    warehouseAddress: 'Gulberg III, Lahore',
    iban: 'PK36SCBL0000001123456701',
    notificationPreferences: {
      emailOrders: true,
      emailReviews: true,
    },
  },
  {
    id: 'reseller-2',
    name: 'Zainab Fashion Hub',
    shopName: 'Zainab Boutique Outlet',
    logo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=250&auto=format&fit=crop',
    banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop',
    rating: 4.8,
    reviewCount: 94,
    responseTime: 'Replies in 30 mins',
    description: 'Premium curated designer lawn, chiffon, and velvet suits at factory leftover prices.',
    joinedDate: 'Mar 2024',
    status: 'Active Seller',
    totalSales: 310,
    city: 'Karachi',
    activeListingsCount: 24,
  },
];

export const ALL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    title: 'Luxury Embroidered Lawn 3-Piece',
    brand: 'Sana Safinaz',
    price: 6490,
    originalPrice: 12500,
    currency: 'Rs.',
    image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=800&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1583391733975-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    additionalImages: [
      'https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1583391733975-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    ],
    badge: '48% OFF',
    category: 'UNSTITCHED',
    stitchingStatus: 'Unstitched',
    pieceCount: '3-Piece',
    fabric: 'Lawn',
    color: 'Emerald Green',
    occasion: 'Festive/Eid',
    description: 'Original factory leftover 3-piece unstitched lawn shirt with organza embroidered neckline, digital print chiffon dupatta, and dyed trousers.',
    inStock: true,
    listingStatus: 'Active In Stock',
    resellerId: 'reseller-1',
    resellerName: 'Ayesha Luxury Leftovers',
    resellerRating: 4.9,
    resellerResponseTime: 'Replies in 15 mins',
    discountPercentage: 48,
  },
  {
    id: 'prod-2',
    title: 'Chiffon Bridal Formal Suit',
    brand: 'Maria B',
    price: 14500,
    originalPrice: 28000,
    currency: 'Rs.',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=800&auto=format&fit=crop',
    additionalImages: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop',
    ],
    badge: 'HOT',
    category: 'BRIDAL WEAR',
    stitchingStatus: 'Unstitched',
    pieceCount: '3-Piece',
    fabric: 'Chiffon',
    color: 'Maroon',
    occasion: 'Bridal',
    description: 'Heavily embroidered pure chiffon front, back, and sleeves with handwork embellishments and silk embroidered dupatta.',
    inStock: true,
    listingStatus: 'Active In Stock',
    resellerId: 'reseller-1',
    resellerName: 'Ayesha Luxury Leftovers',
    resellerRating: 4.9,
    resellerResponseTime: 'Replies in 15 mins',
    discountPercentage: 48,
  },
  {
    id: 'prod-3',
    title: 'Printed Summer Lawn 2-Piece',
    brand: 'Khaadi',
    price: 3490,
    originalPrice: 5990,
    currency: 'Rs.',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=800&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=800&auto=format&fit=crop',
    badge: 'BEST SELLER',
    category: 'UNSTITCHED',
    stitchingStatus: 'Unstitched',
    pieceCount: '2-Piece',
    fabric: 'Lawn',
    color: 'Floral Mustard',
    occasion: 'Casual',
    description: 'Vibrant summer print lawn shirt with matching lawn dupatta. Premium lightweight high-thread count cotton lawn.',
    inStock: true,
    listingStatus: 'Active In Stock',
    resellerId: 'reseller-2',
    resellerName: 'Zainab Boutique Outlet',
    resellerRating: 4.8,
    resellerResponseTime: 'Replies in 30 mins',
    discountPercentage: 42,
  },
  {
    id: 'prod-4',
    title: 'Velvet Embroidered Ready to Wear Kurtis',
    brand: 'Bareeze',
    price: 8990,
    originalPrice: 16000,
    currency: 'Rs.',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=800&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?q=80&w=800&auto=format&fit=crop',
    badge: 'LUXURY PRET',
    category: 'LUXURY PRET',
    stitchingStatus: 'Ready to Wear',
    pieceCount: '1-Piece',
    fabric: 'Velvet',
    color: 'Deep Blue',
    occasion: 'Party Wear',
    description: 'Micro velvet stitched shirt featuring tilla and thread embroidery along cuffs and hemline.',
    inStock: true,
    listingStatus: 'Active In Stock',
    resellerId: 'reseller-1',
    resellerName: 'Ayesha Luxury Leftovers',
    resellerRating: 4.9,
    resellerResponseTime: 'Replies in 15 mins',
    discountPercentage: 44,
  },
  {
    id: 'prod-5',
    title: 'Formal Silk Jacquard 3-Piece',
    brand: 'Asim Jofa',
    price: 11200,
    originalPrice: 21000,
    currency: 'Rs.',
    image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?q=80&w=800&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
    badge: 'LIMITED STOCK',
    category: 'FORMALS',
    stitchingStatus: 'Unstitched',
    pieceCount: '3-Piece',
    fabric: 'Jacquard',
    color: 'Gold & Ivory',
    occasion: 'Party Wear',
    description: 'Woven Jacquard lawn front and back with embroidered borders, metallic zari work, and tissue silk dupatta.',
    inStock: true,
    listingStatus: 'Active In Stock',
    resellerId: 'reseller-2',
    resellerName: 'Zainab Boutique Outlet',
    resellerRating: 4.8,
    resellerResponseTime: 'Replies in 30 mins',
    discountPercentage: 46,
  },
];

export const TRENDING_PRODUCTS = ALL_PRODUCTS;
export const COUTURE_PRODUCTS = ALL_PRODUCTS.slice(0, 3);

export const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    userName: 'Fatima N.',
    customerName: 'Fatima N.',
    rating: 5,
    date: '2 days ago',
    comment: 'Received the suit in perfect condition! Fabric quality is 100% original designer leftover. Fast delivery too.',
    verifiedPurchase: true,
    resellerId: 'reseller-1',
    resellerReply: 'Thank you so much Fatima! We take pride in delivering 100% authentic leftovers.',
    resellerReplyDate: '1 day ago',
  },
  {
    id: 'rev-2',
    userName: 'Saira B.',
    customerName: 'Saira B.',
    rating: 5,
    date: '1 week ago',
    comment: 'Amazing discount! Maria B suit was complete with all patches and original packing tags.',
    verifiedPurchase: true,
    resellerId: 'reseller-1',
  },
];

export const MOCK_RESELLER_ORDERS: Order[] = [
  {
    id: 'ORD-88219',
    date: '2026-07-25',
    createdAt: '2026-07-25',
    totalAmount: 6490,
    status: 'Order Placed',
    dispatchStatus: 'Pending Dispatch',
    customerName: 'Amina Siddiqui',
    customerCity: 'Lahore',
    customerAddress: 'House 42, Block H, DHA Phase 5',
    paymentMethod: 'Cash on Delivery',
    resellerId: 'reseller-1',
    resellerName: 'Ayesha Luxury Leftovers',
    itemsCount: 1,
    items: [
      {
        title: 'Luxury Embroidered Lawn 3-Piece',
        brand: 'Sana Safinaz',
        price: 6490,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=800&auto=format&fit=crop',
      },
    ],
  },
  {
    id: 'ORD-88190',
    date: '2026-07-22',
    createdAt: '2026-07-22',
    totalAmount: 14500,
    status: 'Shipped',
    dispatchStatus: 'Shipped via TCS',
    trackingNumber: 'TCS-9912048',
    courierName: 'TCS Express',
    customerName: 'Hira Tariq',
    customerCity: 'Karachi',
    paymentMethod: 'JazzCash',
    resellerId: 'reseller-1',
    resellerName: 'Ayesha Luxury Leftovers',
    itemsCount: 1,
  },
];

export const MOCK_CUSTOMER_ORDERS: Order[] = MOCK_RESELLER_ORDERS;

export const WORN_AND_LOVED_ITEMS: UGCItem[] = [
  {
    id: 'ugc-1',
    handle: '@maheen_style',
    tag: '#ZebaishStyle',
    image: first,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
    likes: 420,
    productName: 'Sana Safinaz Luxury Lawn',
  },
  {
    id: 'ugc-2',
    handle: '@zara.looks',
    tag: '#LeftoverChic',
    image: second ,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&auto=format&fit=crop',
    likes: 310,
    productName: 'Bareeze Velvet Pret',
  },
  {
    id: 'ugc-3',
    handle: '@alina_glam',
    tag: '#EidGlam',
    image: third,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150&auto=format&fit=crop',
    likes: 580,
    productName: 'Asim Jofa Silk Jacquard',
  },
  {
    id: 'ugc-4',
    handle: '@alina_glam',
    tag: '#EidGlam',  
    image: fourth,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150&auto=format&fit=crop',
    likes: 580,
    productName: 'Asim Jofa Silk Jacquard',
  },
  {
    id: 'ugc-5',
    handle: '@alina_glam',
    tag: '#EidGlam',
    image: fifth,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150&auto=format&fit=crop',
    likes: 580,
    productName: 'Asim Jofa Silk Jacquard',
  },
  {
    id: 'ugc-6',
    handle: '@alina_glam',
    tag: '#EidGlam',
    image: sixth,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150&auto=format&fit=crop',
    likes: 580,
    productName: 'Asim Jofa Silk Jacquard',
  },
];

export const RESELLER_ANALYTICS = {
  topBrands: [
    { brand: 'Sana Safinaz', percentage: 42, revenue: 5400 },
    { brand: 'Maria B', percentage: 35, revenue: 4500 },
    { brand: 'Khaadi', percentage: 15, revenue: 1940 },
    { brand: 'Others', percentage: 8, revenue: 1000 },
  ],
};

export const NEW_ARRIVALS_CATEGORIES: CategoryCard[] = [
  {
    id: 'cat-1',
    title: 'UNSTITCHED',
    image: catUnstitchedLawn,
  },
  {
    id: 'cat-2',
    title: 'READY TO WEAR',
    image: prodPretKurti,
  },
  {
    id: 'cat-3',
    title: 'FORMALS',
    image: calloutRtw,
  },
  {
    id: 'cat-4',
    title: 'ACCESSORIES',
    image: BagAccess,
  },
];

export const TRENDING_TAB_CATEGORIES = [
  'NEW ARRIVALS',
  'UNSTITCHED',
  'LUXURY PRET',
  'BRIDAL WEAR',
  'FORMALS',
];

export const MEGA_MENU_CATEGORIES = [
  {
    id: 'unstitched',
    title: 'UNSTITCHED',
    items: ['3 Piece Lawn', '2 Piece Lawn', '1 Piece / Shirt', 'Chiffon Suits', 'Linen Suits', 'Khaddar Suits', 'Cotton Suits', 'Cambric Suits', 'Printed Unstitched', 'Embroidered Unstitched', 'Digital Printed', 'Jacquard / Silk'],
  },
  {
    id: 'ready-to-wear',
    title: 'READY TO WEAR',
    items: ['Printed Kurtis', 'Embroidered Kurtis', '2 Piece Pret', '3 Piece Pret', 'Luxury Pret', 'Velvet Pret', 'Casual Pret', 'Office / Workwear', 'Co-Ord Sets', 'Long Shirts', 'Trousers & Pants'],
  },
  {
    id: 'formals',
    title: 'FORMALS',
    items: ['Chiffon Formals', 'Organza Dupatta Suit', 'Embroidered Formal', 'Luxury Formal', 'Party Wear', 'Wedding Guest', 'Silk Formal', 'Velvet Formal', 'Long Frocks', 'Gharara / Sharara', 'Maxi', 'Peplum Suits'],
  },
  {
    id: 'Bridal',
    title: 'BRIDAL WEAR (Comming Soon)',
    items: ['Heavy Velvet', 'Maxi & Sharara', 'Bridal Lehenga', 'Bridal Gharara', 'Bridal Sharara', 'Bridal Maxi', 'Pishwas', 'Nikah Dresses', 'Nikkah / Walima', 'Mehndi Dresses', 'Barat Dresses', 'Reception / Walima', 'Bridal Separates'],
  },
  {
    id: 'accessories',
    title: 'ACCESSORIES (Comming Soon)',
    items: ['Bags', 'Jewellery', 'Bangles', 'Clutches', 'Handbags', 'Wallets', 'Scarves / Stoles', 'Hair Accessories', 'Bridal Jewellery', 'Artificial Jewellery', 'Rings', 'Earrings', 'Necklaces', 'Bracelets'],
  },
];

export const HERO_SLIDES = [
  {
    id: 'slide-1',
    image: heroZibaish,
  },
  {
    id: 'slide-2',
    image: heroRiwayatiHusn,
  },
  {
    id: 'slide-3',
    image: heroClassic,
  },
  {
    id: 'slide-4',
    image: heroNafasat,
  },
  {
    id: 'slide-5',
    image: heroRonak,
  },
];

export const FEATURED_CALLOUTS = {
  row1: [
    {
      id: 'feat-1',
      title: '3 PIECE LAWN',
      image: campaignMastaniPortrait,
    },
    {
      id: 'feat-2',
      title: 'LUXURY PRET',
      image: catLuxuryFormals,
    },
  ],
  row2: [
    {
      id: 'feat-3',
      title: 'COUTURE',
      image: coutureMerjan,
    },
    {
      id: 'feat-4',
      title: 'JEWELRY',
      image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=600&auto=format&fit=crop',
    },
    {
      id: 'feat-5',
      title: 'ACCESSORIES',
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=600&auto=format&fit=crop',
    },
  ],
};