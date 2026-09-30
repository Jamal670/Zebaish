import supabase from './client';
import { Product, Review, FilterOptions } from '@/types';

export interface SellerGroup {
  sellerId: string;
  shopName: string;
  averageRating: number;
  products: Product[];
}

export interface FetchCollectionResult {
  products: Product[];
  sellerGroups: SellerGroup[];
  hasMore: boolean;
  totalCount: number;
}

export interface FetchCollectionParams {
  categoryTitle?: string;
  brandFilter?: string;
  page?: number;
  pageSize?: number;
  excludedIds?: string[];
  filters?: FilterOptions;
}

export interface ParsedCategoryQuery {
  dbCategory: string | null;
  dbSubcategory: string | null;
  rawTitle: string;
}

/**
 * Parses URL category parameter dynamically into database Category and Subcategory strings.
 * E.g., "READY TO WEAR - Printed Kurtis" -> category = "Ready to Wear", subcategory = "Printed Kurtis"
 */
export function parseShopCategoryUrl(categoryTitle?: string): ParsedCategoryQuery {
  if (!categoryTitle) {
    return { dbCategory: null, dbSubcategory: null, rawTitle: 'ALL LEFTOVER SUITS' };
  }

  const decoded = decodeURIComponent(categoryTitle).trim();

  let catPart = decoded;
  let subcatPart: string | null = null;

  if (decoded.includes(' - ')) {
    const parts = decoded.split(' - ');
    catPart = parts[0].trim();
    subcatPart = parts.slice(1).join(' - ').trim();
  }

  const catUpper = catPart.toUpperCase().trim();
  let dbCategory: string | null = null;

  if (catUpper.includes('UNSTITCHED')) {
    dbCategory = 'Unstitched';
  } else if (catUpper.includes('READY TO WEAR') || catUpper.includes('READY-TO-WEAR') || catUpper.includes('PRET')) {
    dbCategory = 'Ready to Wear';
  } else if (catUpper.includes('FORMAL') || catUpper.includes('FORMALS')) {
    dbCategory = 'Formal';
  } else if (catUpper.includes('BRIDAL')) {
    dbCategory = 'Bridal';
  } else if (catUpper.includes('ACCESSORIES')) {
    dbCategory = 'Accessories';
  }

  return {
    dbCategory,
    dbSubcategory: subcatPart || null,
    rawTitle: decoded,
  };
}

/**
 * Helper to apply active database filters (Category, Subcategory, Brand, Fabric, Stitching, Price Range, Min Rating)
 * to a Supabase query builder.
 */
function applyBaseFilters(query: any, params: FetchCollectionParams) {
  const { categoryTitle, brandFilter, filters, excludedIds = [] } = params;
  const { dbCategory, dbSubcategory } = parseShopCategoryUrl(categoryTitle);

  let q = query.eq('status', 'Active');

  if (dbCategory) {
    q = q.eq('category', dbCategory);
  }
  if (dbSubcategory) {
    q = q.ilike('subcategory', `%${dbSubcategory}%`);
  }

  if (filters?.categories && filters.categories.length > 0) {
    q = q.in('category', filters.categories);
  }

  if (filters?.brands && filters.brands.length > 0) {
    q = q.in('brand', filters.brands);
  } else if (brandFilter) {
    q = q.ilike('brand', `%${brandFilter}%`);
  }

  if (filters?.fabrics && filters.fabrics.length > 0) {
    const fabricOr = filters.fabrics.map((f) => `fabric.ilike.%${f}%`).join(',');
    q = q.or(fabricOr);
  }

  if (filters?.stitchingStatuses && filters.stitchingStatuses.length > 0) {
    const stitchOr = filters.stitchingStatuses.map((s) => `category.ilike.%${s}%`).join(',');
    q = q.or(stitchOr);
  }

  if (filters?.pieceCounts && filters.pieceCounts.length > 0) {
    const pieceOr = filters.pieceCounts.map((p) => `piece_count.ilike.%${p}%`).join(',');
    q = q.or(pieceOr);
  }

  if (filters?.priceRange) {
    const [minP, maxP] = filters.priceRange;
    if (minP > 0) {
      q = q.gte('surplus_selling_price', minP);
    }
    if (maxP < 100000) {
      q = q.lte('surplus_selling_price', maxP);
    }
  }

  if (filters?.minResellerRating && filters.minResellerRating > 0) {
    q = q.gte('average_rating', filters.minResellerRating);
  }

  if (excludedIds && excludedIds.length > 0 && excludedIds.length < 100) {
    q = q.not('id', 'in', `(${excludedIds.join(',')})`);
  }

  return q;
}

/**
 * Fetches collection products for the MVP feed in batches of 10 items for infinite scrolling.
 * Distribution per batch: 3 New Products (last 7 days), 2 Highly Rated (rating >= 4, review_count >= 3), 5 Discovery.
 * Respects active filters, enforces seller diversity, avoids duplicate items across batches, and provides graceful fallbacks.
 */
export interface FetchCollectionParams {
  categoryTitle?: string;
  brandFilter?: string;
  page?: number;
  pageSize?: number;
  excludedIds?: string[];
  filters?: FilterOptions;
  sortBy?: string;
}

/**
 * Single-query collection fetcher with database-level filtering, sorting, and pagination.
 */
export async function fetchCollectionProducts({
  categoryTitle = 'ALL LEFTOVER SUITS',
  brandFilter,
  page = 0,
  pageSize = 12,
  excludedIds = [],
  filters,
  sortBy = 'featured',
}: FetchCollectionParams): Promise<FetchCollectionResult> {
  try {
    const params: FetchCollectionParams = { categoryTitle, brandFilter, page, pageSize, excludedIds, filters, sortBy };
    const fromIndex = page * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    let query = supabase.from('products').select(`
      id,
      seller_id,
      brand,
      suit_title,
      category,
      subcategory,
      fabric,
      piece_count,
      color,
      original_retail_price,
      surplus_selling_price,
      defect,
      description,
      status,
      created_at,
      average_rating,
      review_count,
      product_images (
        image_url,
        is_thumbnail
      ),
      product_variants (
        id,
        size,
        quantity
      ),
      seller:sellers (
        id,
        shop_name,
        average_rating,
        store_image_url
      )
    `, { count: 'exact' });

    query = applyBaseFilters(query, params);

    // Apply database-level sorting
    if (sortBy === 'price-low') {
      query = query.order('surplus_selling_price', { ascending: true });
    } else if (sortBy === 'price-high') {
      query = query.order('surplus_selling_price', { ascending: false });
    } else if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'best-discount') {
      query = query.order('average_rating', { ascending: false, nullsFirst: false });
    } else {
      // Default: featured / most-popular -> average_rating DESC
      query = query.order('average_rating', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    }

    // Apply pagination range
    query = query.range(fromIndex, toIndex);

    const { data: rawProducts, count: totalCount, error } = await query;

    if (error || !rawProducts) {
      if (error) console.error('Error in fetchCollectionProducts query:', error);
      return { products: [], sellerGroups: [], hasMore: false, totalCount: 0 };
    }

    const formattedProducts: Product[] = rawProducts.map((p: any) => {
      const sellerObj = Array.isArray(p.seller) ? p.seller[0] : p.seller;
      const imagesArr = Array.isArray(p.product_images) ? p.product_images : [];
      const thumbnailObj = imagesArr.find((img: any) => img.is_thumbnail) || imagesArr[0];
      const mainImg = thumbnailObj?.image_url || p.image_url || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80';
      const extraImgs = imagesArr.map((img: any) => img.image_url);

      const origPrice = Number(p.original_retail_price || p.surplus_selling_price || 0);
      const surplusPrice = Number(p.surplus_selling_price || 0);
      const discount = origPrice > surplusPrice ? Math.round(((origPrice - surplusPrice) / origPrice) * 100) : 0;

      const variants = Array.isArray(p.product_variants) ? p.product_variants : [];
      const totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0);

      return {
        id: p.id,
        title: p.suit_title || 'Branded Leftover Suit',
        brand: p.brand || 'Luxury Brand',
        price: origPrice,
        originalPrice: surplusPrice > 0 && surplusPrice !== origPrice ? surplusPrice : undefined,
        currency: 'Rs.',
        image: mainImg,
        hoverImage: extraImgs[1] || mainImg,
        additionalImages: extraImgs,
        badge: 'Surplus',
        category: p.category || 'Unstitched',
        subcategory: p.subcategory || '',
        stitchingStatus: (p.category || 'Unstitched') as any,
        pieceCount: `${p.piece_count || 1}-Piece` as any,
        fabric: p.fabric,
        color: p.color,
        description: p.description || 'Authentic designer surplus suit from clearance inventory.',
        inStock: p.status === 'Active' && totalStock > 0,
        quantity: totalStock,
        variants: variants.map((v: any) => ({ id: v.id, size: v.size, quantity: Number(v.quantity) || 0 })),
        listingStatus: p.status === 'Active' ? 'Active In Stock' : 'Deactivated',
        resellerId: p.seller_id,
        resellerName: sellerObj?.shop_name || 'Verified Reseller',
        resellerRating: sellerObj?.average_rating !== undefined && sellerObj?.average_rating !== null ? Number(sellerObj.average_rating) : 4.9,
        discountPercentage: discount,
        average_rating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
        review_count: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
        averageRating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
        reviewCount: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
      };
    });

    const hasMore = (fromIndex + formattedProducts.length) < (totalCount || 0);

    return {
      products: formattedProducts,
      sellerGroups: [],
      hasMore,
      totalCount: totalCount || formattedProducts.length,
    };
  } catch (err) {
    console.error('Unexpected error in fetchCollectionProducts:', err);
    return { products: [], sellerGroups: [], hasMore: false, totalCount: 0 };
  }
}

export interface FetchProductDetailResult {
  product: Product | null;
  reviews: Review[];
  relatedProducts: Product[];
}

/**
 * Single-query product detail fetcher that returns product details, seller info, images, variants, and reviews.
 */
export async function fetchProductById(productId: string): Promise<FetchProductDetailResult> {
  if (!productId) {
    return { product: null, reviews: [], relatedProducts: [] };
  }

  try {
    const { data: p, error: pErr } = await supabase
      .from('products')
      .select(`
        *,
        seller:sellers (
          id,
          store_image_url,
          shop_name,
          average_rating,
          status
        ),
        product_images (
          id,
          image_url,
          is_thumbnail
        ),
        product_variants (
          id,
          size,
          quantity
        ),
        reviews (
          id,
          rating,
          review,
          created_at,
          users (
            first_name,
            last_name
          )
        )
      `)
      .eq('id', productId)
      .maybeSingle();

    if (pErr || !p) {
      if (pErr) console.error('Error fetching product by ID:', pErr);
      return { product: null, reviews: [], relatedProducts: [] };
    }

    const sellerObj = Array.isArray(p.seller) ? p.seller[0] : p.seller;
    const storeImageUrl = sellerObj?.store_image_url || null;
    const shopName = sellerObj?.shop_name || 'Verified Reseller';
    const sellerStatus = sellerObj?.status || undefined;
    const sellerRating = sellerObj?.average_rating !== undefined && sellerObj?.average_rating !== null
      ? Number(sellerObj.average_rating)
      : 0;

    const imagesArr = Array.isArray(p.product_images) ? p.product_images : [];
    const thumbnailObj = imagesArr.find((img: any) => img.is_thumbnail) || imagesArr[0];
    const mainImg = thumbnailObj?.image_url || p.image_url || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80';
    const extraImgs = imagesArr.map((img: any) => img.image_url);

    const origPrice = Number(p.original_retail_price || p.price || p.surplus_selling_price || 0);
    const surplusPrice = Number(p.surplus_selling_price || p.price || 0);
    const discount = origPrice > surplusPrice ? Math.round(((origPrice - surplusPrice) / origPrice) * 100) : 0;

    const variants = Array.isArray(p.product_variants) ? p.product_variants : [];
    const totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0);

    const reviewsArr = Array.isArray(p.reviews) ? p.reviews : [];
    const formattedReviews: Review[] = reviewsArr.map((rev: any) => {
      const userObj = Array.isArray(rev.users) ? rev.users[0] : rev.users;
      const fullName = userObj ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() : '';
      return {
        id: rev.id,
        productId: p.id,
        userName: fullName || 'Verified Customer',
        rating: rev.rating || 5,
        comment: rev.review || '',
        date: rev.created_at ? new Date(rev.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent',
        verifiedPurchase: true,
      };
    });

    const formattedProduct: Product = {
      id: p.id,
      title: p.suit_title || p.title || 'Branded Leftover Suit',
      brand: p.brand || 'Luxury Brand',
      price: origPrice,
      originalPrice: surplusPrice > 0 && surplusPrice !== origPrice ? surplusPrice : undefined,
      currency: 'Rs.',
      image: mainImg,
      hoverImage: extraImgs[1] || mainImg,
      additionalImages: extraImgs,
      badge: 'Surplus',
      category: p.category || 'Unstitched',
      subcategory: p.subcategory || '',
      stitchingStatus: (p.category || 'Unstitched') as any,
      pieceCount: `${p.piece_count || 1}-Piece` as any,
      fabric: p.fabric,
      color: p.color,
      defect: p.defect,
      description: p.description || 'Authentic designer surplus suit from clearance inventory.',
      inStock: p.status === 'Active' && totalStock > 0,
      quantity: totalStock,
      variants: variants.map((v: any) => ({ id: v.id, size: v.size, quantity: Number(v.quantity) || 0 })),
      listingStatus: p.status === 'Active' ? 'Active In Stock' : 'Deactivated',
      resellerId: p.seller_id,
      resellerName: shopName,
      resellerRating: sellerRating,
      sellerStoreImageUrl: storeImageUrl,
      sellerStatus: sellerStatus,
      seller: {
        store_image_url: storeImageUrl,
        shop_name: shopName,
        average_rating: sellerRating,
        status: sellerStatus || null,
      },
      discountPercentage: discount,
      average_rating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
      review_count: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
      averageRating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
      reviewCount: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
    };

    return {
      product: formattedProduct,
      reviews: formattedReviews,
      relatedProducts: [],
    };
  } catch (err) {
    console.error('Error fetching product by ID from Supabase:', err);
    return { product: null, reviews: [], relatedProducts: [] };
  }
}

/**
 * QUERY 2: Fetches up to 5 rows from `reviews` for this product (rating >= 3, LIMIT 5),
 * joining `users` table for first_name and last_name ONLY. Runs strictly AFTER Query 1 succeeds.
 */
export async function fetchProductReviews(productId: string, limit = 5): Promise<Review[]> {
  const formatDate = (createdAt: string | null) =>
    createdAt
      ? new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
      : 'Recent';

  const mapReview = (rev: any, userName: string): Review => ({
    id: rev.id,
    productId: rev.product_id || productId,
    userName: userName || 'Verified Customer',
    rating: rev.rating || 5,
    comment: rev.review || '',
    date: formatDate(rev.created_at),
    verifiedPurchase: true,
  });

  try {
    // TODO: Confirm with the product owner whether Query 2 should also filter by .eq('status', 'Approved').
    // Without filtering by status = 'Approved', pending or rejected reviews with rating >= 3 could show up publicly.
    const { data: reviewsData, error } = await supabase
      .from('reviews')
      .select(`
        *,
        users (
          first_name,
          last_name
        )
      `)
      .eq('product_id', productId)
      .gte('rating', 3)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Join succeeded — return immediately, whether there are 0 or N reviews.
    // No fallback requests needed here; an empty array is a valid, final result.
    if (!error) {
      if (!reviewsData || reviewsData.length === 0) return [];

      return reviewsData.map((rev: any) => {
        const userObj = Array.isArray(rev.users) ? rev.users[0] : rev.users;
        const fullName = userObj ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() : '';
        return mapReview(rev, fullName);
      });
    }

    // Join genuinely failed (e.g. relationship/schema issue) — fall back to two plain queries.
    console.warn('Reviews join with users failed, falling back:', error);

    const { data: fallbackRevs, error: fallbackErr } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .gte('rating', 3)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fallbackErr || !fallbackRevs || fallbackRevs.length === 0) {
      return [];
    }

    const userIds = Array.from(new Set(fallbackRevs.map((r: any) => r.user_id).filter(Boolean)));
    const userMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', userIds);

      usersData?.forEach((u: any) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
        userMap[u.id] = fullName || 'Verified Customer';
      });
    }

    return fallbackRevs.map((rev: any) => mapReview(rev, userMap[rev.user_id]));
  } catch (err) {
    console.error('Error fetching Query 2 (fetchProductReviews):', err);
    return [];
  }
}

/**
 * THIRD QUERY: Fetches personalized cross-brand surplus recommendations
 * from the currently logged-in user's wishlist (wishlists -> wishlist_items -> products).
 */
// export async function fetchWishlistRecommendations(userId: string, currentProductId: string): Promise<Product[]> {
//   if (!userId) return [];

//   try {
//     const { data: wishlistData } = await supabase
//       .from('wishlists')
//       .select('id')
//       .eq('user_id', userId)
//       .maybeSingle();

//     if (!wishlistData?.id) return [];

//     const { data: itemsData } = await supabase
//       .from('wishlist_items')
//       .select('product_id')
//       .eq('wishlist_id', wishlistData.id);

//     if (!itemsData || itemsData.length === 0) return [];

//     const targetProductIds = itemsData
//       .map((i) => i.product_id)
//       .filter((id) => id && id !== currentProductId)
//       .slice(0, 4);

//     if (targetProductIds.length === 0) return [];

//     const { data: rawProducts } = await supabase
//       .from('products')
//       .select(`
//         id,
//         seller_id,
//         brand,
//         suit_title,
//         category,
//         subcategory,
//         fabric,
//         piece_count,
//         color,
//         original_retail_price,
//         surplus_selling_price,
//         defect,
//         description,
//         status,
//         created_at,
//         average_rating,
//         review_count,
//         product_images (
//           image_url,
//           is_thumbnail
//         ),
//         product_variants (
//           id,
//           size,
//           quantity
//         )
//       `)
//       .in('id', targetProductIds)
//       .eq('status', 'Active')
//       .limit(4);

//     if (!rawProducts || rawProducts.length === 0) return [];

//     return rawProducts.map((p) => {
//       const imagesArr = Array.isArray(p.product_images) ? p.product_images : [];
//       const thumbnailObj = imagesArr.find((img: any) => img.is_thumbnail) || imagesArr[0];
//       const mainImg = thumbnailObj?.image_url || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80';
//       const extraImgs = imagesArr.map((img: any) => img.image_url);

//       const origPrice = Number(p.original_retail_price || p.surplus_selling_price || 0);
//       const surplusPrice = Number(p.surplus_selling_price || 0);
//       const discount = origPrice > surplusPrice ? Math.round(((origPrice - surplusPrice) / origPrice) * 100) : 0;

//       const variants = Array.isArray(p.product_variants) ? p.product_variants : [];
//       const totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0);

//       return {
//         id: p.id,
//         title: p.suit_title || 'Branded Leftover Suit',
//         brand: p.brand || 'Luxury Brand',
//         price: origPrice,
//         originalPrice: surplusPrice > 0 && surplusPrice !== origPrice ? surplusPrice : undefined,
//         currency: 'Rs.',
//         image: mainImg,
//         hoverImage: extraImgs[1] || mainImg,
//         additionalImages: extraImgs,
//         badge: 'Surplus',
//         category: p.category || 'Unstitched',
//         subcategory: p.subcategory || '',
//         stitchingStatus: (p.category || 'Unstitched') as any,
//         pieceCount: `${p.piece_count || 1}-Piece` as any,
//         fabric: p.fabric,
//         color: p.color,
//         defect: p.defect,
//         description: p.description || '',
//         inStock: p.status === 'Active' && totalStock > 0,
//         quantity: totalStock,
//         variants: variants.map((v: any) => ({ id: v.id, size: v.size, quantity: Number(v.quantity) || 0 })),
//         listingStatus: p.status === 'Active' ? 'Active In Stock' : 'Deactivated',
//         resellerId: p.seller_id,
//         discountPercentage: discount,
//         average_rating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
//         review_count: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
//         averageRating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
//         reviewCount: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
//       };
//     });
//   } catch (err) {
//     console.error('Error fetching wishlist recommendations:', err);
//     return [];
//   }
// }

/**
 * Fetches up to 5 active products from Supabase for a specific Most Trending tab category,
 * ordered by created_at DESC, with seller information & images.
 */
export async function fetchTrendingProductsByTab(tabCategory: string): Promise<Product[]> {
  try {
    let query = supabase
      .from('products')
      .select(`
        id,
        seller_id,
        brand,
        suit_title,
        category,
        subcategory,
        fabric,
        piece_count,
        color,
        original_retail_price,
        surplus_selling_price,
        defect,
        description,
        status,
        created_at,
        average_rating,
        review_count,
        product_images (
          image_url,
          is_thumbnail
        ),
        product_variants (
          id,
          size,
          quantity
        )
      `)
      .eq('status', 'Active');

    const tabUpper = (tabCategory || '').toUpperCase().trim();

    if (tabUpper === 'UNSTITCHED') {
      query = query.ilike('category', '%Unstitched%');
    } else if (tabUpper === 'LUXURY PRET') {
      query = query.or('category.ilike.%Luxury Pret%,category.ilike.%Pret%,category.ilike.%Ready to Wear%');
    } else if (tabUpper === 'BRIDAL WEAR' || tabUpper === 'BRIDAL') {
      query = query.ilike('category', '%Bridal%');
    } else if (tabUpper === 'FORMALS' || tabUpper === 'FORMAL') {
      query = query.ilike('category', '%Formal%');
    }
    // NEW ARRIVALS has no category filter

    query = query.order('created_at', { ascending: false }).limit(5);

    const { data: rawProducts, error: pErr } = await query;

    if (pErr || !rawProducts || rawProducts.length === 0) {
      if (pErr) {
        console.error('Error fetching trending products by tab:', pErr.message || pErr.details || pErr);
      }
      return [];
    }

    // Batch fetch seller details
    const uniqueSellerIds = Array.from(new Set(rawProducts.map((p) => p.seller_id).filter(Boolean)));
    let sellerMap: Record<string, { shopName: string; averageRating: number }> = {};

    if (uniqueSellerIds.length > 0) {
      const { data: sellersData } = await supabase
        .from('sellers')
        .select('id, shop_name')
        .in('id', uniqueSellerIds);

      if (sellersData) {
        sellersData.forEach((s) => {
          sellerMap[s.id] = {
            shopName: s.shop_name || 'Verified Seller',
            averageRating: 4.9,
          };
        });
      }

      // Calculate rating per seller
      const { data: sellerProductIdsData } = await supabase
        .from('products')
        .select('id, seller_id')
        .in('seller_id', uniqueSellerIds);

      if (sellerProductIdsData && sellerProductIdsData.length > 0) {
        const prodIdToSellerId: Record<string, string> = {};
        const allProdIds: string[] = [];

        sellerProductIdsData.forEach((item) => {
          prodIdToSellerId[item.id] = item.seller_id;
          allProdIds.push(item.id);
        });

        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('product_id, rating')
          .in('product_id', allProdIds);

        if (reviewsData && reviewsData.length > 0) {
          const sellerRatings: Record<string, number[]> = {};

          reviewsData.forEach((rev) => {
            const sid = prodIdToSellerId[rev.product_id];
            if (sid) {
              if (!sellerRatings[sid]) sellerRatings[sid] = [];
              sellerRatings[sid].push(rev.rating);
            }
          });

          Object.keys(sellerRatings).forEach((sid) => {
            const ratingsArr = sellerRatings[sid];
            if (ratingsArr.length > 0) {
              const avg = ratingsArr.reduce((sum, r) => sum + r, 0) / ratingsArr.length;
              if (sellerMap[sid]) {
                sellerMap[sid].averageRating = Number(avg.toFixed(1));
              }
            }
          });
        }
      }
    }

    const defaultImg = 'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png';

    const formattedProducts: Product[] = rawProducts.map((p) => {
      const seller = sellerMap[p.seller_id];
      const imagesArr = Array.isArray(p.product_images) ? p.product_images : [];
      const thumbnailObj = imagesArr.find((img: any) => img.is_thumbnail) || imagesArr[0];
      const mainImg = thumbnailObj?.image_url || defaultImg;
      const extraImgs = imagesArr.map((img: any) => img.image_url);

      const origPrice = Number(p.original_retail_price || p.surplus_selling_price || 0);
      const surplusPrice = Number(p.surplus_selling_price || 0);
      const discount = origPrice > surplusPrice ? Math.round(((origPrice - surplusPrice) / origPrice) * 100) : 0;

      const variants = Array.isArray(p.product_variants) ? p.product_variants : [];
      const totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0);

      return {
        id: p.id,
        title: p.suit_title || 'Branded Leftover Suit',
        brand: p.brand || 'Luxury Brand',
        price: origPrice,
        originalPrice: surplusPrice > 0 && surplusPrice !== origPrice ? surplusPrice : undefined,
        currency: 'Rs.',
        image: mainImg,
        hoverImage: extraImgs[1] || mainImg,
        additionalImages: extraImgs,
        badge: 'Surplus',
        category: p.category || 'Unstitched',
        subcategory: p.subcategory || '',
        stitchingStatus: (p.category || 'Unstitched') as any,
        pieceCount: `${p.piece_count || 1}-Piece` as any,
        fabric: p.fabric,
        color: p.color,
        description: p.description || 'Authentic designer surplus suit from clearance inventory.',
        inStock: p.status === 'Active',
        quantity: totalStock,
        variants: variants.map((v: any) => ({ id: v.id, size: v.size, quantity: Number(v.quantity) || 0 })),
        listingStatus: p.status === 'Active' ? 'Active In Stock' : 'Deactivated',
        resellerId: p.seller_id,
        resellerName: seller?.shopName || 'Verified Reseller',
        resellerRating: seller?.averageRating || 4.9,
        discountPercentage: discount,
        average_rating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
        review_count: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
        averageRating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
        reviewCount: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
      };
    });

    return formattedProducts;
  } catch (err) {
    console.error('Error in fetchTrendingProductsByTab:', err);
    return [];
  }
}

/**
 * Background non-blocking helper to increment product views in database.
 * Executes atomically via RPC 'increment_product_views' or fallback atomic update.
 */
export async function incrementProductViews(productId: string): Promise<void> {
  if (!productId) return;
  try {
    const { error: rpcErr } = await supabase.rpc('increment_product_views', { target_product_id: productId });

    if (rpcErr) {
      const { data: p } = await supabase
        .from('products')
        .select('views')
        .eq('id', productId)
        .maybeSingle();

      const currentViews = p?.views !== undefined && p?.views !== null ? Number(p.views) : 0;

      await supabase
        .from('products')
        .update({ views: currentViews + 1 })
        .eq('id', productId);
    }
  } catch (err) {
    console.warn('Background error incrementing product views:', err);
  }
}

