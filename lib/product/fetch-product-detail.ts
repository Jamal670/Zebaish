import { SupabaseClient } from '@supabase/supabase-js';
import {
  FetchProductDetailResult,
  ProductDetail,
  ProductDetailImage,
  ProductOption,
  ProductOptionValue,
  ProductSeller,
  SpecRow,
} from './types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80';

export function isValidUuid(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Resolves a product image URL using image_url or Supabase storage_path fallback.
 */
export function resolveImageUrl(
  img: { image_url?: string | null; storage_path?: string | null },
  supabase: SupabaseClient
): string {
  if (img.image_url && img.image_url.trim().length > 0) {
    return img.image_url.trim();
  }
  if (img.storage_path && img.storage_path.trim().length > 0) {
    const { data } = supabase.storage.from('productImages').getPublicUrl(img.storage_path.trim());
    if (data?.publicUrl) {
      return data.publicUrl;
    }
  }
  return DEFAULT_FALLBACK_IMAGE;
}

/**
 * Single value formatter for product attributes:
 * - text -> trimmed text
 * - number -> strip trailing zeros (e.g. 12.5000 -> 12.5)
 * - boolean -> "Yes" / "No"
 * - jsonb array -> comma separated values
 * - jsonb scalar -> string
 * - other jsonb objects -> skip row (returns null)
 * - empty -> returns null
 */
export function formatAttributeValue(row: {
  value_text?: string | null;
  value_number?: number | string | null;
  value_boolean?: boolean | null;
  value_jsonb?: any;
}): string | null {
  if (row.value_text !== null && row.value_text !== undefined) {
    const trimmed = String(row.value_text).trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (row.value_number !== null && row.value_number !== undefined) {
    const num = Number(row.value_number);
    if (!isNaN(num)) {
      return String(num);
    }
    const trimmed = String(row.value_number).trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (row.value_boolean !== null && row.value_boolean !== undefined) {
    return row.value_boolean ? 'Yes' : 'No';
  }
  if (row.value_jsonb !== null && row.value_jsonb !== undefined) {
    const v = row.value_jsonb;
    if (Array.isArray(v)) {
      const items = v
        .map((item) => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item).trim()))
        .filter(Boolean);
      return items.length > 0 ? items.join(', ') : null;
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      const s = String(v).trim();
      return s.length > 0 ? s : null;
    }
    // Other jsonb objects are skipped
    return null;
  }
  return null;
}

/**
 * Normalizes raw Supabase row and options into a strongly-typed ProductDetail.
 */
export function normalizeProductDetail(
  row: any,
  rawOptions: any[],
  specs: SpecRow[],
  supabase: SupabaseClient
): { product: ProductDetail; images: string[] } {
  const inventoryMode = (row.inventory_mode === 'variants' ? 'variants' : 'simple') as 'simple' | 'variants';

  // 1. Image processing (Thumbnail first, then display_order ascending)
  const rawImages: any[] = Array.isArray(row.product_images) ? [...row.product_images] : [];
  rawImages.sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));

  const thumbnailIndex = rawImages.findIndex((img) => img.is_thumbnail === true);
  let sortedImages: any[] = [];
  if (thumbnailIndex >= 0) {
    const thumbnail = rawImages[thumbnailIndex];
    sortedImages = [thumbnail, ...rawImages.filter((_, idx) => idx !== thumbnailIndex)];
  } else {
    sortedImages = rawImages;
  }

  const normalizedImages: ProductDetailImage[] = sortedImages.map((img) => {
    const resolvedUrl = resolveImageUrl(img, supabase);
    return {
      id: img.id,
      image_url: resolvedUrl,
      storage_path: img.storage_path || null,
      alt_text: img.alt_text || row.title || 'Product image',
      is_thumbnail: Boolean(img.is_thumbnail),
      display_order: Number(img.display_order) || 0,
    };
  });

  const imageUrls: string[] =
    normalizedImages.length > 0
      ? normalizedImages.map((img) => img.image_url)
      : [row.image_url || DEFAULT_FALLBACK_IMAGE];

  // 2. Pricing & Stock logic: selling_price by default; if null, cached_min_variant_price
  const defaultSellingPrice =
    row.selling_price !== null && row.selling_price !== undefined
      ? Number(row.selling_price)
      : row.cached_min_variant_price !== null && row.cached_min_variant_price !== undefined
        ? Number(row.cached_min_variant_price)
        : Number(row.price) || 0;

  let price = defaultSellingPrice;
  let compareAtPrice: number | null = null;
  let maxPrice: number | null = null;
  let quantity = 0;

  if (inventoryMode === 'variants') {
    price = defaultSellingPrice;
    const rawMax = Number(row.cached_max_variant_price) || 0;
    maxPrice = rawMax > 0 && rawMax !== price ? rawMax : null;
    compareAtPrice = null;
    quantity = Number(row.cached_total_variant_quantity) || 0;
  } else {
    price = defaultSellingPrice;
    const rawCompare = Number(row.compare_at_price) || 0;
    compareAtPrice = rawCompare > price ? rawCompare : null;
    maxPrice = null;
    quantity = Number(row.quantity) || 0;
  }

  const isOutOfStock = quantity <= 0 || row.status === 'sold_out';
  const status: 'active' | 'sold_out' = row.status === 'sold_out' ? 'sold_out' : 'active';

  // 3. Seller (left embed, explicit columns only)
  const sellerRaw = Array.isArray(row.sellers) ? row.sellers[0] : row.sellers;
  const seller: ProductSeller | null = sellerRaw
    ? {
        id: sellerRaw.id,
        shop_name: sellerRaw.shop_name || 'Verified Seller',
        store_image_url: sellerRaw.store_image_url || null,
        average_rating: sellerRaw.average_rating ? Number(sellerRaw.average_rating) : null,
        status: sellerRaw.status || null,
      }
    : null;

  // 4. Options and Option Values (only if inventoryMode === 'variants')
  const options: ProductOption[] =
    inventoryMode === 'variants'
      ? (Array.isArray(rawOptions) ? rawOptions : [])
          .map((opt: any) => {
            const rawValues: any[] = Array.isArray(opt.product_option_values) ? [...opt.product_option_values] : [];
            rawValues.sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));

            const optionValues: ProductOptionValue[] = rawValues.map((val: any) => ({
              id: val.id,
              option_id: val.option_id,
              product_id: val.product_id,
              value: val.value || '',
              normalized_value: val.normalized_value || undefined,
              display_order: Number(val.display_order) || 0,
            }));

            return {
              id: opt.id,
              product_id: opt.product_id,
              name: opt.name || '',
              display_order: Number(opt.display_order) || 0,
              product_option_values: optionValues,
            };
          })
          .sort((a, b) => a.display_order - b.display_order)
      : [];

  const mainImage = imageUrls[0] || DEFAULT_FALLBACK_IMAGE;

  const product: ProductDetail = {
    id: row.id,
    title: row.title || 'Untitled Product',
    brand: row.brand || null,
    condition: row.condition || null,
    inventoryMode,
    price,
    compareAtPrice,
    maxPrice,
    quantity,
    isOutOfStock,
    status,
    description: row.description || null,
    rating: row.average_rating !== null && row.average_rating !== undefined ? Number(row.average_rating) : 0,
    reviewCount: row.review_count !== null && row.review_count !== undefined ? Number(row.review_count) : 0,
    images: imageUrls,
    productImages: normalizedImages,
    seller,
    options,
    specs,

    // Backward-compatibility fields
    originalPrice: compareAtPrice || undefined,
    surplus_selling_price: price,
    original_retail_price: compareAtPrice || undefined,
    currency: 'Rs.',
    image: mainImage,
    hoverImage: imageUrls[1] || mainImage,
    additionalImages: imageUrls,
    badge: row.condition ? row.condition : isOutOfStock ? 'Sold Out' : undefined,
    category: row.category || 'General',
    subcategory: row.subcategory || undefined,
    fabric: row.fabric || undefined,
    color: row.color || undefined,
    defect: row.defect || undefined,
    resellerId: seller?.id,
    resellerName: seller?.shop_name,
    sellerStoreImageUrl: seller?.store_image_url || null,
    resellerRating: seller?.average_rating || 0,
    inStock: !isOutOfStock,
    average_rating: row.average_rating !== null && row.average_rating !== undefined ? Number(row.average_rating) : 0,
    review_count: row.review_count !== null && row.review_count !== undefined ? Number(row.review_count) : 0,
  };

  return { product, images: imageUrls };
}

function withSignal<T>(query: T, signal?: AbortSignal): T {
  if (signal && typeof (query as any)?.abortSignal === 'function') {
    return (query as any).abortSignal(signal);
  }
  return query;
}

/**
 * Fetches real product detail data with Query 1, Query 2a, Query 2b in parallel via Promise.allSettled.
 */
export async function fetchProductDetail(
  supabase: SupabaseClient,
  id: string,
  signal?: AbortSignal
): Promise<FetchProductDetailResult> {
  const cleanId = (id || '').trim();

  // Validate UUID before query
  if (!isValidUuid(cleanId)) {
    return {
      product: null,
      images: [],
      specs: [],
      options: [],
      optionImages: new Map(),
      notFound: true,
      error: null,
    };
  }

  // 1. Query 1: product + images + seller + options (active status only)
  const q1Builder = supabase
    .from('products')
    .select(`
      *,
      sellers ( id, shop_name, store_image_url ),
      product_images ( id, image_url, storage_path, alt_text, is_thumbnail, display_order ),
      product_options ( id, name, display_order,
        product_option_values ( id, value, display_order ) )
    `)
    .eq('id', cleanId)
    .eq('status', 'active')
    .order('display_order', { referencedTable: 'product_images' })
    .order('display_order', { referencedTable: 'product_options' })
    .order('display_order', { referencedTable: 'product_options.product_option_values' });

  const q1Promise = withSignal(q1Builder, signal).maybeSingle();

  // 2. Query 2a: category-defined attribute values
  const q2aBuilder = supabase
    .from('product_attribute_values')
    .select(`
      id, attribute_id, value_text, value_number, value_boolean, value_jsonb,
      category_attribute_definitions ( id, name, sort_order )
    `)
    .eq('product_id', cleanId);

  const q2aPromise = withSignal(q2aBuilder, signal);

  // 3. Query 2b: seller-defined custom attributes
  const q2bBuilder = supabase
    .from('product_custom_attributes')
    .select('id, name, value, display_order')
    .eq('product_id', cleanId)
    .order('display_order', { ascending: true });

  const q2bPromise = withSignal(q2bBuilder, signal);

  // Fire Q1, Q2a, Q2b together
  const [q1Settled, q2aSettled, q2bSettled] = await Promise.allSettled([
    q1Promise,
    q2aPromise,
    q2bPromise,
  ]);

  if (signal?.aborted) {
    return {
      product: null,
      images: [],
      specs: [],
      options: [],
      optionImages: new Map(),
      notFound: false,
      error: 'Aborted',
    };
  }

  // Check Query 1 result
  if (q1Settled.status === 'rejected') {
    return {
      product: null,
      images: [],
      specs: [],
      options: [],
      optionImages: new Map(),
      notFound: false,
      error: q1Settled.reason?.message || 'Failed to fetch product details.',
    };
  }

  let productRow = q1Settled.value.data;
  let q1Error = q1Settled.value.error;
  let rawOptions: any[] = [];

  // Fallback for Q1 if nested embed of product_options fails
  if (q1Error) {
    if (
      q1Error.code === 'PGRST200' ||
      q1Error.code === 'PGRST201' ||
      q1Error.message?.includes('relationship') ||
      q1Error.message?.includes('product_options')
    ) {
      const fallbackQ1Builder = supabase
        .from('products')
        .select(`
          *,
          sellers ( id, shop_name, store_image_url ),
          product_images ( id, image_url, storage_path, alt_text, is_thumbnail, display_order )
        `)
        .eq('id', cleanId)
        .eq('status', 'active')
        .order('display_order', { referencedTable: 'product_images' });

      const fallbackQ1 = await withSignal(fallbackQ1Builder, signal).maybeSingle();

      if (fallbackQ1.error) {
        return {
          product: null,
          images: [],
          specs: [],
          options: [],
          optionImages: new Map(),
          notFound: false,
          error: fallbackQ1.error.message,
        };
      }
      productRow = fallbackQ1.data;
      q1Error = null;
    } else {
      return {
        product: null,
        images: [],
        specs: [],
        options: [],
        optionImages: new Map(),
        notFound: false,
        error: q1Error.message,
      };
    }
  }

  if (!productRow) {
    return {
      product: null,
      images: [],
      specs: [],
      options: [],
      optionImages: new Map(),
      notFound: true,
      error: null,
    };
  }

  // Process options if inventory_mode === 'variants'
  if (productRow.inventory_mode === 'variants') {
    if (Array.isArray(productRow.product_options) && productRow.product_options.length > 0) {
      rawOptions = productRow.product_options;
    } else {
      // Chained options query if not embedded
      try {
        const optsBuilder = supabase
          .from('product_options')
          .select('*')
          .eq('product_id', cleanId)
          .order('display_order', { ascending: true });

        const { data: opts } = await withSignal(optsBuilder, signal);

        if (Array.isArray(opts) && opts.length > 0) {
          const optIds = opts.map((o) => o.id);
          const valsBuilder = supabase
            .from('product_option_values')
            .select('*')
            .in('option_id', optIds)
            .order('display_order', { ascending: true });

          const { data: vals } = await withSignal(valsBuilder, signal);

          const valMap = new Map<string, any[]>();
          (vals || []).forEach((v) => {
            const list = valMap.get(v.option_id) || [];
            list.push(v);
            valMap.set(v.option_id, list);
          });

          rawOptions = opts.map((o) => ({
            ...o,
            product_option_values: valMap.get(o.id) || [],
          }));
        }
      } catch {
        rawOptions = [];
      }
    }
  }

  // Option images loading (one-time load for variant products)
  const optionImagesMap = new Map<string, string>();
  if (productRow.inventory_mode === 'variants' && rawOptions.length > 0) {
    try {
      const validValueIds = new Set<string>();
      rawOptions.forEach((opt: any) => {
        (opt.product_option_values || []).forEach((v: any) => validValueIds.add(v.id));
      });

      const optImgBuilder = supabase
        .from('product_option_images')
        .select('product_option_value_id, storage_path, image_url, created_at')
        .eq('product_id', cleanId)
        .order('created_at', { ascending: true });

      const { data: optImgRows } = await withSignal(optImgBuilder, signal);

      if (Array.isArray(optImgRows)) {
        for (const row of optImgRows) {
          if (row.product_option_value_id && validValueIds.has(row.product_option_value_id)) {
            if (!optionImagesMap.has(row.product_option_value_id)) {
              let url = '';
              if (row.image_url && row.image_url.trim().length > 0) {
                url = row.image_url.trim();
              } else if (row.storage_path && row.storage_path.trim().length > 0) {
                const { data } = supabase.storage
                  .from('productImages')
                  .getPublicUrl(row.storage_path.trim());
                if (data?.publicUrl) url = data.publicUrl;
              }
              if (url) {
                optionImagesMap.set(row.product_option_value_id, url);
              }
            }
          }
        }
      }
    } catch {
      // Non-critical, ignore
    }
  }

  // Process Specifications (2a and 2b)
  const catSpecs: SpecRow[] = [];
  if (q2aSettled.status === 'fulfilled' && !q2aSettled.value.error && Array.isArray(q2aSettled.value.data)) {
    const rawList = q2aSettled.value.data;
    // Check if category_attribute_definitions embedded successfully
    const needsFallback = rawList.some(
      (item: any) => item.attribute_id && !item.category_attribute_definitions?.name
    );

    let resolvedList = rawList;
    if (needsFallback) {
      try {
        const attrIds = Array.from(new Set(rawList.map((item: any) => item.attribute_id).filter(Boolean)));
        if (attrIds.length > 0) {
          const defsBuilder = supabase
            .from('category_attribute_definitions')
            .select('id, name, sort_order')
            .in('id', attrIds);

          const { data: defs } = await withSignal(defsBuilder, signal);

          if (defs) {
            const defMap = new Map(defs.map((d: any) => [d.id, d]));
            resolvedList = rawList.map((item: any) => ({
              ...item,
              category_attribute_definitions: defMap.get(item.attribute_id) || item.category_attribute_definitions,
            }));
          }
        }
      } catch {
        // Continue with what we have
      }
    }

    resolvedList.forEach((item: any) => {
      const defObj = Array.isArray(item.category_attribute_definitions)
        ? item.category_attribute_definitions[0]
        : item.category_attribute_definitions;
      const label = defObj?.name?.trim();
      const val = formatAttributeValue(item);
      if (label && val) {
        catSpecs.push({
          id: item.id || item.attribute_id,
          label,
          value: val,
        });
      }
    });

    // Sort category specs by definition sort_order
    catSpecs.sort((a, b) => {
      const itemA = resolvedList.find((i: any) => i.id === a.id);
      const itemB = resolvedList.find((i: any) => i.id === b.id);
      const defA = Array.isArray(itemA?.category_attribute_definitions)
        ? itemA.category_attribute_definitions[0]
        : itemA?.category_attribute_definitions;
      const defB = Array.isArray(itemB?.category_attribute_definitions)
        ? itemB.category_attribute_definitions[0]
        : itemB?.category_attribute_definitions;
      const orderA = Number(defA?.sort_order) || 0;
      const orderB = Number(defB?.sort_order) || 0;
      return orderA - orderB;
    });
  }

  const customSpecs: SpecRow[] = [];
  if (q2bSettled.status === 'fulfilled' && !q2bSettled.value.error && Array.isArray(q2bSettled.value.data)) {
    q2bSettled.value.data.forEach((item: any) => {
      const label = item.name?.trim();
      const val = String(item.value ?? '').trim();
      if (label && val) {
        customSpecs.push({
          id: item.id,
          label,
          value: val,
        });
      }
    });
  }

  // Deduplicate custom specs case-insensitively against category specs
  const seenLabels = new Set(catSpecs.map((s) => s.label.toLowerCase()));
  const filteredCustomSpecs = customSpecs.filter((s) => !seenLabels.has(s.label.toLowerCase()));
  const mergedSpecs: SpecRow[] = [...catSpecs, ...filteredCustomSpecs];

  const { product, images } = normalizeProductDetail(productRow, rawOptions, mergedSpecs, supabase);

  return {
    product,
    images,
    specs: mergedSpecs,
    options: product.options,
    optionImages: optionImagesMap,
    notFound: false,
    error: null,
  };
}
