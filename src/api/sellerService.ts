import supabase from './client';
import { Product, Reseller, Review } from '@/types';
import { MOCK_RESELLERS, ALL_PRODUCTS, MOCK_REVIEWS } from '@/data/mockData';

export interface MergedProductData extends Product {
  totalUnitsSold: number;
  totalOrders: number;
  averageRating: number;
  reviewsCount: number;
}

export interface SellerStorefrontData {
  seller: Reseller;
  products: MergedProductData[];
  reviews: Review[];
  totalUnitsSold: number;
  totalOrders: number;
}

/**
 * Validates whether a string is a valid UUID format
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Converts a shop name or identifier to a clean, lowercase URL slug with spaces removed.
 * E.g. "The Economy Store" -> "theeconomystore", "The%20Economy%20Store" -> "theeconomystore"
 */
export function formatStoreSlug(shopName?: string, fallbackId?: string): string {
  const target = shopName && shopName.trim() ? shopName : fallbackId;
  if (target && target.trim()) {
    try {
      const decoded = decodeURIComponent(target.trim());
      return decoded.toLowerCase().replace(/\s+/g, '');
    } catch {
      return target.trim().toLowerCase().replace(/\s+/g, '');
    }
  }
  return '';
}

/**
 * Resolves a seller record from the `sellers` table using either UUID or shop_name.
 * Supports exact match, lowercase slug with spaces removed (e.g. "theeconomystore"),
 * hyphenated slugs, and case-insensitive names.
 */
export async function resolveSellerRecord(identifier: string) {
  if (!identifier) return null;
  const decoded = decodeURIComponent(identifier).trim();
  const normalizedIncoming = formatStoreSlug(decoded);

  // 1. If valid UUID, search by id
  if (isValidUUID(decoded)) {
    const { data: byId } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', decoded)
      .maybeSingle();
    if (byId) return byId;
  }

  // 2. Case-insensitive exact match on shop_name
  const { data: byShopName } = await supabase
    .from('sellers')
    .select('*')
    .ilike('shop_name', decoded)
    .maybeSingle();

  if (byShopName) return byShopName;

  // 3. Match normalized slug with spaces removed (e.g. "theeconomystore" -> "The Economy Store")
  const { data: allSellers } = await supabase.from('sellers').select('*');
  if (allSellers && allSellers.length > 0) {
    const matched = allSellers.find((s: any) => formatStoreSlug(s.shop_name) === normalizedIncoming);
    if (matched) return matched;
  }

  // 4. Try replacing hyphens with spaces (e.g. "muasam-collection" -> "muasam collection")
  if (decoded.includes('-')) {
    const spaceVariant = decoded.replace(/-/g, ' ');
    const { data: bySpace } = await supabase
      .from('sellers')
      .select('*')
      .ilike('shop_name', spaceVariant)
      .maybeSingle();

    if (bySpace) return bySpace;
  }

  // 5. Try replacing underscores with spaces
  if (decoded.includes('_')) {
    const spaceVariant = decoded.replace(/_/g, ' ');
    const { data: bySpace } = await supabase
      .from('sellers')
      .select('*')
      .ilike('shop_name', spaceVariant)
      .maybeSingle();

    if (bySpace) return bySpace;
  }

  // 6. Wildcard match on shop_name
  const cleanTerm = decoded.replace(/[-_]/g, '%');
  const { data: byWildcard } = await supabase
    .from('sellers')
    .select('*')
    .ilike('shop_name', `%${cleanTerm}%`)
    .limit(1);

  if (byWildcard && byWildcard.length > 0) return byWildcard[0];

  return null;
}

/**
 * Formats ISO date string to readable format e.g. "Jan 2024" or "2 days ago"
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Fetches seller profile, order items, products, and approved reviews in batch requests.
 * Searches seller dynamically by either UUID or shop_name.
 * Merges statistics (units sold, total orders, average rating, review count) efficiently without N+1 queries.
 */
export async function fetchSellerStorefrontData(sellerIdOrShopName: string): Promise<SellerStorefrontData> {
  // Dynamically resolve seller record by UUID or shop_name
  const rawSeller = await resolveSellerRecord(sellerIdOrShopName);

  // If not found in database, check fallback mock data gracefully for demo reseller IDs
  if (!rawSeller) {
    const decoded = decodeURIComponent(sellerIdOrShopName || '').trim();
    const normalized = formatStoreSlug(decoded);
    const mockSeller = MOCK_RESELLERS.find((r) =>
      formatStoreSlug(r.id) === normalized ||
      formatStoreSlug(r.shopName) === normalized
    ) || MOCK_RESELLERS[0];
    const mockProds = ALL_PRODUCTS.filter((p) => p.resellerId === mockSeller.id || (!p.resellerId && mockSeller.id === 'reseller-1'));

    let mockTotalReviews = 0;
    let mockWeightedSum = 0;
    for (const p of mockProds) {
      const count = Number(p.review_count ?? p.reviewCount ?? 0);
      const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
      const rating = Number(p.average_rating ?? p.averageRating ?? 0);
      const safeRating = Number.isFinite(rating) ? Math.min(Math.max(rating, 0), 5) : 0;
      if (safeCount > 0) {
        mockTotalReviews += safeCount;
        mockWeightedSum += safeRating * safeCount;
      }
    }
    const mockAvgRating = mockTotalReviews > 0 ? mockWeightedSum / mockTotalReviews : (mockSeller.rating || 0);

    const mergedProducts: MergedProductData[] = mockProds.map((p) => {
      const rawCategory = typeof p.category === 'string' ? p.category.trim() : (p.category ? String(p.category).trim() : '');
      const cleanCategory = rawCategory.length > 0 ? rawCategory : '';
      return {
        ...p,
        category: cleanCategory,
        stitchingStatus: cleanCategory || undefined,
        totalUnitsSold: 15,
        totalOrders: 10,
        averageRating: 4.9,
        reviewsCount: MOCK_REVIEWS.length,
      };
    });

    return {
      seller: {
        ...mockSeller,
        rating: Math.min(Math.max(mockAvgRating, 0), 5),
        reviewCount: mockTotalReviews > 0 ? mockTotalReviews : (mockSeller.reviewCount || 0),
      },
      products: mergedProducts,
      reviews: MOCK_REVIEWS,
      totalUnitsSold: mockSeller.totalSales || 450,
      totalOrders: 320,
    };
  }

  const sellerId = rawSeller.id;

  // 1. Fetch Order Items for this Seller from `order_items` table
  const orderItemsPromise = supabase
    .from('order_items')
    .select('*')
    .eq('seller_id', sellerId);

  // 2. Fetch Seller Orders from `seller_orders` table
  const sellerOrdersPromise = supabase
    .from('seller_orders')
    .select('id, seller_total, status')
    .eq('seller_id', sellerId);

  // 3. Fetch Products listed by this Seller from `products` table (only Active status)
  // Optimize by not joining heavy base64 product_images directly to prevent statement timeout
  const productsPromise = supabase
    .from('products')
    .select(`
      *,
      category,
      product_variants (
        id,
        size,
        quantity
      )
    `)
    .eq('seller_id', sellerId)
    .eq('status', 'Active');

  // 4. Query average_rating and review_count across ALL products of this seller (unfiltered by status or pagination)
  const sellerRatingsPromise = supabase
    .from('products')
    .select('average_rating, review_count')
    .eq('seller_id', sellerId);

  const [orderItemsRes, sellerOrdersRes, productsRes, sellerRatingsRes] = await Promise.all([
    orderItemsPromise,
    sellerOrdersPromise,
    productsPromise,
    sellerRatingsPromise,
  ]);

  const rawOrderItems = orderItemsRes.data || [];
  const rawSellerOrders = sellerOrdersRes.data || [];
  const rawProducts = productsRes.data || [];

  // Batch-fetch thumbnail images only for this seller's products to ensure fast response (< 1s)
  const sellerProductIds = rawProducts.map((p: any) => p.id);
  const imageMap = new Map<string, string>();

  if (sellerProductIds.length > 0) {
    const { data: thumbData } = await supabase
      .from('product_images')
      .select('product_id, image_url, is_thumbnail')
      .in('product_id', sellerProductIds)
      .eq('is_thumbnail', true);

    thumbData?.forEach((img: any) => {
      imageMap.set(img.product_id, img.image_url);
    });

    const missingPids = sellerProductIds.filter((id: string) => !imageMap.has(id));
    if (missingPids.length > 0) {
      const { data: fallbackData } = await supabase
        .from('product_images')
        .select('product_id, image_url')
        .in('product_id', missingPids);
      fallbackData?.forEach((img: any) => {
        if (!imageMap.has(img.product_id)) {
          imageMap.set(img.product_id, img.image_url);
        }
      });
    }
  }

  // Group order_items by product_id
  const orderStatsMap = new Map<string, { totalUnitsSold: number; totalOrders: number }>();
  let sellerTotalUnitsSold = 0;

  for (const item of rawOrderItems) {
    const pId = item.product_id;
    const qty = Number(item.quantity) || 1;
    sellerTotalUnitsSold += qty;

    const existing = orderStatsMap.get(pId) || { totalUnitsSold: 0, totalOrders: 0 };
    orderStatsMap.set(pId, {
      totalUnitsSold: existing.totalUnitsSold + qty,
      totalOrders: existing.totalOrders + 1,
    });
  }

  // Calculate dynamic sold items count (prefer sum of order_items quantity, fallback to seller_orders count)
  const totalSoldSuits = sellerTotalUnitsSold || rawSellerOrders.length || 0;

  // Extract all unique product IDs (from products table + order_items table)
  const productIdsSet = new Set<string>();
  rawProducts.forEach((p: any) => productIdsSet.add(p.id));
  rawOrderItems.forEach((item: any) => {
    if (item.product_id) productIdsSet.add(item.product_id);
  });
  const allProductIds = Array.from(productIdsSet);

  // 5. Batch Fetch Reviews for all seller products from `reviews` table in a SINGLE query
  let rawReviews: any[] = [];
  if (allProductIds.length > 0) {
    const reviewsRes = await supabase
      .from('reviews')
      .select(`
        *,
        users (
          first_name,
          last_name
        )
      `)
      .in('product_id', allProductIds);

    if (!reviewsRes.error && reviewsRes.data) {
      // Filter for approved reviews if status column is present
      rawReviews = reviewsRes.data.filter((r: any) => !r.status || r.status === 'Approved');
    }
  }

  // Group reviews by product_id
  const productReviewsMap = new Map<string, any[]>();
  for (const rev of rawReviews) {
    const pId = rev.product_id;
    const list = productReviewsMap.get(pId) || [];
    list.push(rev);
    productReviewsMap.set(pId, list);
  }

  // Map reviews into UI format
  const mappedReviews: Review[] = rawReviews.map((rev: any) => {
    const userName = rev.users
      ? `${rev.users.first_name || ''} ${rev.users.last_name || ''}`.trim()
      : 'Customer';
    return {
      id: rev.id,
      userName: userName || 'Customer',
      rating: rev.rating || 5,
      date: formatDate(rev.created_at),
      comment: rev.review || 'Great product!',
      verifiedPurchase: true,
      productId: rev.product_id,
      resellerId: sellerId,
    };
  });

  // Calculate overall seller metrics: weighted average rating and total review count across all products
  const rawRatingsList = sellerRatingsRes?.data || [];
  let totalReviews = 0;
  let weightedRatingSum = 0;

  for (const item of rawRatingsList) {
    const rawCount = Number(item.review_count);
    const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 0;
    const rawRating = Number(item.average_rating);
    const rating = Number.isFinite(rawRating) ? Math.min(Math.max(rawRating, 0), 5) : 0;

    if (count > 0) {
      totalReviews += count;
      weightedRatingSum += rating * count;
    }
  }

  const computedSellerRating = totalReviews > 0 ? weightedRatingSum / totalReviews : 0;
  const sellerAverageRating = Math.min(Math.max(computedSellerRating, 0), 5);
  const totalSellerReviewsCount = totalReviews;

  const sellerImage =
    rawSeller?.store_image_url ||
    rawSeller?.avatar_url ||
    rawSeller?.logo_url ||
    'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png';
  const sellerShopName = rawSeller?.shop_name || rawSeller?.full_name || 'Verified Reseller';

  // Build Reseller object
  const seller: Reseller = {
    id: rawSeller?.id || sellerId,
    name: rawSeller?.full_name || 'Verified Reseller',
    shopName: sellerShopName,
    logo: sellerImage,
    store_image_url: sellerImage,
    banner: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
    rating: sellerAverageRating,
    reviewCount: totalSellerReviewsCount,
    responseTime: 'Replies in 15 mins',
    description: 'Authentic 100% original designer leftover suits directly sourced from factory overstocks.',
    joinedDate: formatDate(rawSeller?.created_at),
    status: rawSeller?.status === 'Active' ? 'Active Seller' : 'Approved',
    totalSales: totalSoldSuits,
    city: rawSeller?.city || 'Pakistan',
    activeListingsCount: rawProducts.length,
  };

  // Map products into MergedProductData structure
  const mergedProducts: MergedProductData[] = rawProducts.map((p: any) => {
    const pId = p.id;
    const prodReviews = productReviewsMap.get(pId) || [];
    const reviewsCount = prodReviews.length;
    const averageRating =
      reviewsCount > 0
        ? Math.round((prodReviews.reduce((sum: number, r: any) => sum + (r.rating || 5), 0) / reviewsCount) * 10) / 10
        : 5.0;

    const stats = orderStatsMap.get(pId) || { totalUnitsSold: 0, totalOrders: 0 };

    // Format images
    const thumb = imageMap.get(pId) || p.image_url || 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=800&auto=format&fit=crop';
    const hoverImg = thumb;
    const addlImgs = [thumb];

    const price = Number(p.surplus_selling_price) || 0;
    const origPrice = Number(p.original_retail_price) || price;
    const discountPct = origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0;

    const parsePieceCount = (val: any): '1-Piece' | '2-Piece' | '3-Piece' | '4-Piece' => {
      const num = Number(val);
      if (num === 1) return '1-Piece';
      if (num === 2) return '2-Piece';
      if (num === 4) return '4-Piece';
      return '3-Piece';
    };

    const variantsList = p.product_variants || [];
    const totalVariantStock = variantsList.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0);
    const effectiveQuantity = variantsList.length > 0 ? totalVariantStock : Number(p.quantity ?? 1);

    const rawCategory = typeof p.category === 'string' ? p.category.trim() : (p.category ? String(p.category).trim() : '');
    const cleanCategory = rawCategory.length > 0 ? rawCategory : '';

    return {
      id: p.id,
      title: p.suit_title || 'Designer Leftover Suit',
      brand: p.brand || 'Designer Brand',
      price: price,
      originalPrice: origPrice > price ? origPrice : undefined,
      currency: 'Rs.',
      image: thumb,
      hoverImage: hoverImg,
      additionalImages: addlImgs.length > 0 ? addlImgs : [thumb],
      badge: discountPct > 0 ? `${discountPct}% OFF` : undefined,
      category: cleanCategory,
      subcategory: p.subcategory || (p.piece_count ? String(p.piece_count) : undefined),
      stitchingStatus: cleanCategory || undefined,
      pieceCount: parsePieceCount(p.piece_count),
      fabric: p.fabric || 'Lawn',
      color: p.color || 'Multi',
      description: p.description || '',
      quantity: effectiveQuantity,
      variants: variantsList.map((v: any) => ({ id: v.id, size: v.size, quantity: Number(v.quantity) || 0 })),
      inStock: p.status === 'Active' && effectiveQuantity > 0,
      listingStatus: p.status === 'Active' ? 'Active In Stock' : p.status === 'Sold Out' ? 'Sold Out' : 'Deactivated',
      resellerId: sellerId,
      resellerName: seller.shopName,
      resellerRating: averageRating,
      resellerResponseTime: seller.responseTime,
      discountPercentage: discountPct > 0 ? discountPct : undefined,
      totalUnitsSold: stats.totalUnitsSold,
      totalOrders: stats.totalOrders,
      averageRating: averageRating,
      reviewsCount: reviewsCount,
    };
  });

  return {
    seller,
    products: mergedProducts,
    reviews: mappedReviews,
    totalUnitsSold: sellerTotalUnitsSold,
    totalOrders: rawOrderItems.length,
  };
}

export interface FetchReviewsResult {
  reviews: Review[];
  hasMore: boolean;
  totalCount: number;
}

/**
 * Fetches reviews specifically belonging to an authenticated seller using Supabase range-based pagination.
 * Batches 9 reviews per page and prevents duplicate DB queries.
 * Supports searching seller by either UUID or shop_name.
 */
export async function fetchSellerReviewsPaginated(
  sellerIdOrShopName: string,
  page: number = 0,
  pageSize: number = 9
): Promise<FetchReviewsResult> {
  let sellerId = sellerIdOrShopName;

  if (!isValidUUID(sellerIdOrShopName)) {
    const resolved = await resolveSellerRecord(sellerIdOrShopName);
    if (resolved) {
      sellerId = resolved.id;
    } else {
      const start = page * pageSize;
      const end = start + pageSize;
      const paged = MOCK_REVIEWS.slice(start, end);
      return {
        reviews: paged,
        hasMore: end < MOCK_REVIEWS.length,
        totalCount: MOCK_REVIEWS.length,
      };
    }
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  // 1. Fetch product IDs belonging to this seller
  const { data: sellerProducts } = await supabase
    .from('products')
    .select('id')
    .eq('seller_id', sellerId);

  const productIds = (sellerProducts || []).map((p: any) => p.id);

  if (productIds.length === 0) {
    return {
      reviews: [],
      hasMore: false,
      totalCount: 0,
    };
  }

  // 2. Fetch paginated reviews for those products
  const { data, count, error } = await supabase
    .from('reviews')
    .select(`
      *,
      users (
        first_name,
        last_name
      )
    `, { count: 'exact' })
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching seller reviews page:', error);
    throw error;
  }

  const mappedReviews: Review[] = (data || []).map((rev: any) => {
    const userName = rev.users
      ? `${rev.users.first_name || ''} ${rev.users.last_name || ''}`.trim()
      : 'Customer';

    return {
      id: rev.id,
      userName: userName || 'Customer',
      rating: rev.rating || 5,
      date: formatDate(rev.created_at),
      comment: rev.review || 'Great product!',
      verifiedPurchase: true,
      productId: rev.product_id,
      resellerId: sellerId,
    };
  });

  const totalCount = count || 0;
  const hasMore = from + mappedReviews.length < totalCount;

  return {
    reviews: mappedReviews,
    hasMore,
    totalCount,
  };
}

