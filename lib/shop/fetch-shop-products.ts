import { SupabaseClient } from '@supabase/supabase-js';

export const PAGE_SIZE = 8;

export type ProductCondition = 'new' | 'used' | 'refurbished' | 'open_box' | string;
export type PriceStatus = 'ready' | 'pending' | 'unavailable';

export interface ShopProduct {
  id: string;
  title: string;
  brand: string | null;
  condition: ProductCondition;
  inventoryMode: 'simple' | 'variants';

  // Price
  price: number | null;
  maxPrice: number | null;
  compareAtPrice: number | null;
  priceStatus: PriceStatus;

  // Stock
  quantity: number | null;
  totalVariantQuantity: number | null;
  isOutOfStock: boolean;
  lowStockText: string | null;

  // Badges
  discountPercent: number | null;
  conditionBadge: string | null;

  // Rating
  averageRating: number | null;
  reviewCount: number;

  // Image
  imageUrl: string | null;
  imageAlt: string;

  // Seller
  shopName: string;
  storeImageUrl: string | null;
}

export interface FetchShopPageParams {
  categoryIds?: string[] | null;
  page: number;
  signal?: AbortSignal;
}

export interface FetchShopPageResult {
  products: ShopProduct[];
  hasMore: boolean;
  page: number;
}

/**
 * Normalizes raw Supabase row into clean ShopProduct.
 */
export function normalizeShopProduct(row: any, supabase: SupabaseClient): ShopProduct {
  const inventoryMode = (row.inventory_mode === 'variants' ? 'variants' : 'simple') as 'simple' | 'variants';

  // Product Images (LEFT JOIN style via embedded select)
  const images = Array.isArray(row.product_images) ? row.product_images : [];
  const thumbnail = images[0];

  let imageUrl: string | null = null;
  if (thumbnail?.image_url) {
    imageUrl = thumbnail.image_url;
  } else if (thumbnail?.storage_path) {
    const { data } = supabase.storage.from('productImages').getPublicUrl(thumbnail.storage_path);
    imageUrl = data?.publicUrl || null;
  }

  const imageAlt = thumbnail?.alt_text || row.title || 'Product image';

  // Sellers (!inner join)
  const sellerData = Array.isArray(row.sellers) ? row.sellers[0] : row.sellers;
  const shopName = sellerData?.shop_name || 'Verified Seller';
  const storeImageUrl = sellerData?.store_image_url || null;

  // Ratings
  const reviewCount = row.review_count !== null && row.review_count !== undefined ? Number(row.review_count) : 0;
  const averageRating = row.average_rating !== null && row.average_rating !== undefined ? Number(row.average_rating) : null;

  // Condition Badge
  const rawCondition = (row.condition || '').toLowerCase().trim();
  let conditionBadge: string | null = null;
  if (rawCondition === 'used') conditionBadge = 'Used';
  else if (rawCondition === 'refurbished') conditionBadge = 'Refurbished';
  else if (rawCondition === 'open_box') conditionBadge = 'Open Box';

  // Price & Stock logic based on inventory_mode
  let price: number | null = null;
  let maxPrice: number | null = null;
  let compareAtPrice: number | null = null;
  let priceStatus: PriceStatus = 'ready';
  let discountPercent: number | null = null;

  let quantity: number | null = null;
  let totalVariantQuantity: number | null = null;
  let isOutOfStock = false;
  let lowStockText: string | null = null;

  if (inventoryMode === 'simple') {
    price = row.selling_price !== null && row.selling_price !== undefined ? Number(row.selling_price) : null;
    compareAtPrice = row.compare_at_price !== null && row.compare_at_price !== undefined ? Number(row.compare_at_price) : null;
    quantity = row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : 0;

    if (price !== null && compareAtPrice !== null && compareAtPrice > price) {
      discountPercent = Math.round((1 - price / compareAtPrice) * 100);
    }

    if (quantity === 0) {
      isOutOfStock = true;
    } else if (quantity >= 1 && quantity <= 5) {
      lowStockText = `Only ${quantity} left`;
    }
  } else {
    // variants mode
    const cachedMin = row.cached_min_variant_price !== null && row.cached_min_variant_price !== undefined
      ? Number(row.cached_min_variant_price)
      : null;
    const cachedMax = row.cached_max_variant_price !== null && row.cached_max_variant_price !== undefined
      ? Number(row.cached_max_variant_price)
      : null;

    totalVariantQuantity = row.cached_total_variant_quantity !== null && row.cached_total_variant_quantity !== undefined
      ? Number(row.cached_total_variant_quantity)
      : null;

    if (cachedMin !== null) {
      price = cachedMin;
      maxPrice = cachedMax !== null ? cachedMax : cachedMin;
      priceStatus = 'ready';
    } else {
      // Missing cache: fallback needed
      price = null;
      maxPrice = null;
      priceStatus = 'pending';
    }

    if (totalVariantQuantity !== null && totalVariantQuantity === 0) {
      isOutOfStock = true;
    }
  }

  return {
    id: String(row.id),
    title: String(row.title || 'Untitled Product'),
    brand: row.brand ? String(row.brand).trim() : null,
    condition: rawCondition || 'new',
    inventoryMode,
    price,
    maxPrice,
    compareAtPrice,
    priceStatus,
    quantity,
    totalVariantQuantity,
    isOutOfStock,
    lowStockText,
    discountPercent,
    conditionBadge,
    averageRating,
    reviewCount,
    imageUrl,
    imageAlt,
    shopName,
    storeImageUrl,
  };
}

/**
 * Fetches 1 page of products from Supabase.
 * Fetches PAGE_SIZE + 1 rows to determine `hasMore` without a separate count query.
 */
export async function fetchShopPage(
  supabase: SupabaseClient,
  { categoryIds, page, signal }: FetchShopPageParams
): Promise<FetchShopPageResult> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE; // gives PAGE_SIZE + 1 rows (e.g. 0 to 8 = 9 rows)

  let query = supabase
    .from('products')
    .select(`
      id, title, brand, condition, inventory_mode,
      selling_price, compare_at_price, quantity,
      cached_min_variant_price, cached_max_variant_price, cached_total_variant_quantity,
      average_rating, review_count, created_at,
      sellers!inner ( shop_name, store_image_url ),
      product_images ( image_url, storage_path, alt_text, is_thumbnail )
    `)
    .eq('status', 'active')
    .eq('product_images.is_thumbnail', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (categoryIds && categoryIds.length > 0) {
    query = query.in('category_id', categoryIds);
  }

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching shop products:', error);
    throw new Error(error.message || 'Failed to fetch products');
  }

  const rows = data || [];
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const products = pageRows.map((r) => normalizeShopProduct(r, supabase));

  return {
    products,
    hasMore,
    page,
  };
}

/**
 * Fallback query for variants-mode products where cached_min_variant_price was NULL.
 * Computes min & max prices from active variants.
 */
export async function resolveVariantPrices(
  supabase: SupabaseClient,
  productIds: string[],
  signal?: AbortSignal
): Promise<Record<string, { min: number; max: number } | null>> {
  if (!productIds || productIds.length === 0) return {};

  let query = supabase
    .from('product_variants')
    .select('product_id, selling_price, is_active, quantity')
    .in('product_id', productIds)
    .eq('is_active', true);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  const result: Record<string, { min: number; max: number } | null> = {};
  for (const id of productIds) {
    result[id] = null; // default unavailable
  }

  if (error) {
    console.warn('Error fetching fallback variant prices:', error);
    return result;
  }

  const rows = data || [];
  const grouped: Record<string, number[]> = {};

  for (const row of rows) {
    const pid = String(row.product_id);
    const sp = row.selling_price !== null && row.selling_price !== undefined ? Number(row.selling_price) : null;
    if (sp !== null && !isNaN(sp)) {
      if (!grouped[pid]) grouped[pid] = [];
      grouped[pid].push(sp);
    }
  }

  for (const pid of productIds) {
    const prices = grouped[pid];
    if (prices && prices.length > 0) {
      result[pid] = {
        min: Math.min(...prices),
        max: Math.max(...prices),
      };
    }
  }

  return result;
}

