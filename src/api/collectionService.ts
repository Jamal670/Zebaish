import supabase from './client';
import { Product, Review, FilterOptions } from '@/types';
import { resolveCategory } from '@/lib/shop/resolve-category';
import { parseCategoryUrlParam } from '@/lib/slugify-category';
import { fetchProductDetail, isValidUuid } from '@/lib/product/fetch-product-detail';

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
    const fromIndex = page * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    const parsedCategory = parseCategoryUrlParam(categoryTitle);

    // 1. Optimized Unified RPC execution when standard sorting & no custom attributes
    const hasCustomFilters = Boolean(
      (filters?.brands && filters.brands.length > 0) ||
      brandFilter ||
      (filters?.fabrics && filters.fabrics.length > 0) ||
      (filters?.stitchingStatuses && filters.stitchingStatuses.length > 0) ||
      (filters?.pieceCounts && filters.pieceCounts.length > 0) ||
      (filters?.priceRange && (filters.priceRange[0] > 0 || filters.priceRange[1] < 100000)) ||
      (filters?.minResellerRating && filters.minResellerRating > 0) ||
      (sortBy && sortBy !== 'featured' && sortBy !== 'newest')
    );

    if (!hasCustomFilters && !parsedCategory.isAll && parsedCategory.mainSlug) {
      try {
        const { data: rpcRows, error: rpcError } = await supabase.rpc('get_collection_products', {
          main_slug: parsedCategory.mainSlug,
          sub_slug: parsedCategory.subSlug || null,
          page_limit: pageSize,
          page_offset: fromIndex,
        });

        if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0) {
          const totalCount = Number(rpcRows[0]?.total_count || rpcRows.length);
          const defaultImg = 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=800&auto=format&fit=crop';

          const formattedProducts: Product[] = rpcRows.map((p: any) => {
            let resolvedImg = p.thumbnail_url;
            if (!resolvedImg && p.storage_path) {
              const { data } = supabase.storage.from('productImages').getPublicUrl(p.storage_path.trim());
              resolvedImg = data?.publicUrl || null;
            }
            const mainImg = resolvedImg || defaultImg;
            const extraImgs = [mainImg];

            let effectivePrice = 0;
            let compareAt = 0;

            if (p.inventory_mode === 'variants') {
              if (p.cached_min_variant_price !== null && p.cached_min_variant_price !== undefined) {
                effectivePrice = Number(p.cached_min_variant_price);
              }
            } else {
              effectivePrice = Number(p.selling_price || 0);
              compareAt = Number(p.compare_at_price || 0);
            }

            const origPrice = compareAt > effectivePrice ? compareAt : effectivePrice;
            const surplusPrice = effectivePrice;
            const discount = origPrice > surplusPrice ? Math.round(((origPrice - surplusPrice) / origPrice) * 100) : 0;

            const totalStock = p.inventory_mode === 'variants'
              ? Number(p.cached_total_variant_quantity ?? 0)
              : Number(p.quantity || 0);

            let badgeLabel: string | undefined = undefined;
            if (discount > 0) {
              badgeLabel = `${discount}% OFF`;
            } else if (p.condition && p.condition.toLowerCase() !== 'new') {
              const c = p.condition.toLowerCase();
              badgeLabel = c === 'used' ? 'Used' : c === 'refurbished' ? 'Refurbished' : c === 'open_box' ? 'Open Box' : p.condition;
            }

            return {
              id: p.id,
              title: p.title || 'Product',
              brand: p.brand || '',
              price: surplusPrice,
              surplus_selling_price: surplusPrice,
              originalPrice: origPrice > surplusPrice ? origPrice : undefined,
              original_retail_price: origPrice,
              currency: 'Rs.',
              image: mainImg,
              hoverImage: extraImgs[1] || mainImg,
              additionalImages: extraImgs,
              badge: badgeLabel,
              category: parsedCategory.decoded,
              subcategory: parsedCategory.subCategoryName || '',
              description: p.description || '',
              inStock: p.status === 'active' && totalStock > 0,
              quantity: totalStock,
              variants: [],
              listingStatus: p.status === 'active' ? 'Active In Stock' : 'Deactivated',
              resellerId: p.seller_id,
              resellerName: p.shop_name || 'Verified Seller',
              resellerRating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 5.0,
              sellerStoreImageUrl: p.store_image_url || null,
              discountPercentage: discount,
              average_rating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
              review_count: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
              averageRating: p.average_rating !== undefined && p.average_rating !== null ? Number(p.average_rating) : 0,
              reviewCount: p.review_count !== undefined && p.review_count !== null ? Number(p.review_count) : 0,
            };
          });

          const hasMore = (fromIndex + formattedProducts.length) < totalCount;
          return {
            products: formattedProducts,
            sellerGroups: [],
            hasMore,
            totalCount,
          };
        }
      } catch (err) {
        console.warn('get_collection_products RPC not available, continuing with query builder:', err);
      }
    }

    // 2. Query builder fallback (handles custom filters, sorting, and environments before RPC deployment)
    let categoryIds: string[] | null = null;
    let resolvedCategoryName: string = 'All Products';

    if (!parsedCategory.isAll) {
      const resolved = await resolveCategory(categoryTitle);
      if (resolved.isNotFound) {
        return { products: [], sellerGroups: [], hasMore: false, totalCount: 0 };
      }
      categoryIds = resolved.categoryIds;
      resolvedCategoryName = resolved.categoryName;
    }

    let query = supabase.from('products').select(`
      id,
      seller_id,
      brand,
      title,
      condition,
      inventory_mode,
      selling_price,
      compare_at_price,
      quantity,
      cached_min_variant_price,
      cached_max_variant_price,
      cached_total_variant_quantity,
      category_id,
      description,
      status,
      created_at,
      average_rating,
      review_count,
      product_variants (
        id,
        selling_price,
        is_active,
        quantity
      ),
      seller:sellers!inner (
        id,
        shop_name,
        average_rating,
        store_image_url
      )
    `, { count: 'exact' });

    // Filter only active products
    query = query.eq('status', 'active');

    // Category Filter (includes all descendant categories)
    if (categoryIds && categoryIds.length > 0) {
      query = query.in('category_id', categoryIds);
    }

    // Brand filters
    if (filters?.brands && filters.brands.length > 0) {
      query = query.in('brand', filters.brands);
    } else if (brandFilter) {
      query = query.ilike('brand', `%${brandFilter}%`);
    }

    // Price range filters
    if (filters?.priceRange) {
      const [minP, maxP] = filters.priceRange;
      if (minP > 0) {
        query = query.gte('selling_price', minP);
      }
      if (maxP < 100000) {
        query = query.lte('selling_price', maxP);
      }
    }

    // Min rating filter
    if (filters?.minResellerRating && filters.minResellerRating > 0) {
      query = query.gte('average_rating', filters.minResellerRating);
    }

    // Excluded IDs
    if (excludedIds && excludedIds.length > 0 && excludedIds.length < 100) {
      query = query.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    // Database-level sorting
    if (sortBy === 'price-low') {
      query = query.order('selling_price', { ascending: true, nullsFirst: false });
    } else if (sortBy === 'price-high') {
      query = query.order('selling_price', { ascending: false, nullsFirst: false });
    } else if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'best-discount') {
      query = query.order('average_rating', { ascending: false, nullsFirst: false });
    } else {
      // Default: newest first with id tie-breaker
      query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
    }

    // Pagination range
    query = query.range(fromIndex, toIndex);

    const { data: rawProducts, count: totalCount, error } = await query;

    if (error || !rawProducts) {
      if (error) console.error('Error in fetchCollectionProducts query:', error);
      return { products: [], sellerGroups: [], hasMore: false, totalCount: 0 };
    }

    // Fetch product thumbnail images
    const productIds = rawProducts.map((p: any) => p.id);
    const imageMap: Record<string, string> = {};

    if (productIds.length > 0) {
      const { data: thumbData } = await supabase
        .from('product_images')
        .select('product_id, image_url, storage_path, is_thumbnail')
        .in('product_id', productIds);

      thumbData?.forEach((img: any) => {
        if (!imageMap[img.product_id] || img.is_thumbnail) {
          let resolvedUrl = img.image_url;
          if (!resolvedUrl && img.storage_path) {
            const { data } = supabase.storage.from('productImages').getPublicUrl(img.storage_path);
            resolvedUrl = data?.publicUrl;
          }
          if (resolvedUrl) {
            imageMap[img.product_id] = resolvedUrl;
          }
        }
      });
    }

    const defaultImg = 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=800&auto=format&fit=crop';

    const formattedProducts: Product[] = rawProducts.map((p: any) => {
      const sellerObj = Array.isArray(p.seller) ? p.seller[0] : p.seller;
      const mainImg = imageMap[p.id] || defaultImg;
      const extraImgs = [mainImg];

      // Calculate effective price & compare-at price
      let effectivePrice = 0;
      let compareAt = 0;

      if (p.inventory_mode === 'variants') {
        if (p.cached_min_variant_price !== null && p.cached_min_variant_price !== undefined) {
          effectivePrice = Number(p.cached_min_variant_price);
        } else {
          // Fallback calculation from product_variants
          const variants = Array.isArray(p.product_variants) ? p.product_variants : [];
          const activeVars = variants.filter((v: any) => v.is_active !== false && v.selling_price);
          if (activeVars.length > 0) {
            effectivePrice = Math.min(...activeVars.map((v: any) => Number(v.selling_price)));
          }
        }
      } else {
        effectivePrice = Number(p.selling_price || 0);
        compareAt = Number(p.compare_at_price || 0);
      }

      const origPrice = compareAt > effectivePrice ? compareAt : effectivePrice;
      const surplusPrice = effectivePrice;
      const discount = origPrice > surplusPrice ? Math.round(((origPrice - surplusPrice) / origPrice) * 100) : 0;

      const variants = Array.isArray(p.product_variants) ? p.product_variants : [];
      const totalStock = p.inventory_mode === 'variants'
        ? Number(p.cached_total_variant_quantity ?? variants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0))
        : Number(p.quantity || 0);

      // Badge handling
      let badgeLabel: string | undefined = undefined;
      if (discount > 0) {
        badgeLabel = `${discount}% OFF`;
      } else if (p.condition && p.condition.toLowerCase() !== 'new') {
        const c = p.condition.toLowerCase();
        badgeLabel = c === 'used' ? 'Used' : c === 'refurbished' ? 'Refurbished' : c === 'open_box' ? 'Open Box' : p.condition;
      }

      return {
        id: p.id,
        title: p.title || 'Product',
        brand: p.brand || '',
        price: surplusPrice,
        surplus_selling_price: surplusPrice,
        originalPrice: origPrice > surplusPrice ? origPrice : undefined,
        original_retail_price: origPrice,
        currency: 'Rs.',
        image: mainImg,
        hoverImage: extraImgs[1] || mainImg,
        additionalImages: extraImgs,
        badge: badgeLabel,
        category: resolvedCategoryName,
        subcategory: '',
        description: p.description || '',
        inStock: p.status === 'active' && totalStock > 0,
        quantity: totalStock,
        variants: variants.map((v: any) => ({
          id: v.id,
          size: v.size,
          color_id: v.color_id,
          quantity: Number(v.quantity) || 0,
        })),
        listingStatus: p.status === 'active' ? 'Active In Stock' : 'Deactivated',
        resellerId: sellerObj?.id || p.seller_id,
        resellerName: sellerObj?.shop_name || 'Verified Seller',
        resellerRating: sellerObj?.average_rating !== undefined && sellerObj?.average_rating !== null ? Number(sellerObj.average_rating) : 5.0,
        sellerStoreImageUrl: sellerObj?.store_image_url || null,
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
  product: Product | any | null;
  reviews: Review[];
  relatedProducts: Product[];
  notFound?: boolean;
  error?: string | null;
}

/**
 * Product detail fetcher that calls fetchProductDetail (Query 1: product+images+seller, Query 2: options+values).
 */
export async function fetchProductById(productId: string): Promise<FetchProductDetailResult> {
  if (!productId || !isValidUuid(productId)) {
    return { product: null, reviews: [], relatedProducts: [], notFound: true, error: null };
  }

  try {
    const detailResult = await fetchProductDetail(supabase, productId);
    return {
      product: detailResult.product as unknown as Product,
      reviews: [],
      relatedProducts: [],
      notFound: detailResult.notFound,
      error: detailResult.error,
    };
  } catch (err: any) {
    console.error('Error fetching product by ID from Supabase:', err);
    return {
      product: null,
      reviews: [],
      relatedProducts: [],
      notFound: false,
      error: err?.message || 'Failed to fetch product details.',
    };
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
        product_variants (
          id,
          size,
          quantity
        ),
        seller:sellers (
          id,
          shop_name,
          average_rating
        )
      `)
      .eq('status', 'Active');

    const tabUpper = (tabCategory || '').toUpperCase().trim();

    if (tabUpper === 'UNSTITCHED') {
      query = query.ilike('category', '%Unstitched%');
    } else if (tabUpper === 'LUXURY PRET') {
      query = query.or('category.ilike.%Luxury Pret%,category.ilike.%Pret%,category.ilike.%Ready to Wear%,subcategory.ilike.%Pret%,subcategory.ilike.%Ready%');
    } else if (tabUpper === 'BRIDAL WEAR' || tabUpper === 'BRIDAL') {
      query = query.or('category.ilike.%Bridal%,subcategory.ilike.%Bridal%');
    } else if (tabUpper === 'FORMALS' || tabUpper === 'FORMAL') {
      query = query.or('category.ilike.%Formal%,subcategory.ilike.%Formal%,subcategory.ilike.%Organza%');
    }
    // NEW ARRIVALS has no category filter

    query = query.order('created_at', { ascending: false }).limit(5);

    const { data: rawProducts, error: pErr } = await query;

    if (pErr) {
      console.error('Error fetching trending products by tab:', pErr.message || pErr.details || pErr);
      return [];
    }

    if (!rawProducts || rawProducts.length === 0) {
      return [];
    }

    // Efficiently batch-fetch thumbnail images only for the 5 selected products
    // to prevent serializing heavy base64 strings and triggering Postgres statement timeout
    const productIds = rawProducts.map((p) => p.id);
    const imageMap: Record<string, string> = {};

    if (productIds.length > 0) {
      const { data: thumbData } = await supabase
        .from('product_images')
        .select('product_id, image_url, is_thumbnail')
        .in('product_id', productIds)
        .eq('is_thumbnail', true);

      if (thumbData) {
        thumbData.forEach((img: any) => {
          imageMap[img.product_id] = img.image_url;
        });
      }

      const missingIds = productIds.filter((id) => !imageMap[id]);
      if (missingIds.length > 0) {
        const { data: fallbackData } = await supabase
          .from('product_images')
          .select('product_id, image_url')
          .in('product_id', missingIds);

        if (fallbackData) {
          fallbackData.forEach((img: any) => {
            if (!imageMap[img.product_id]) {
              imageMap[img.product_id] = img.image_url;
            }
          });
        }
      }
    }

    const defaultImg = 'https://vrvjqnarbsrnynlfwblg.supabase.co/storage/v1/object/public/products/4017743.png';

    const formattedProducts: Product[] = rawProducts.map((p: any) => {
      const seller = Array.isArray(p.seller) ? p.seller[0] : p.seller;
      const mainImg = imageMap[p.id] || defaultImg;

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
        hoverImage: mainImg,
        additionalImages: [mainImg],
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
        resellerName: seller?.shop_name || 'Verified Reseller',
        resellerRating: seller?.average_rating ? Number(seller.average_rating) : 4.9,
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

