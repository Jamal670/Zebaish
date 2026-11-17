import supabase from '@/src/api/client';

// ============================================================================
// Public seller storefront (/{shop}) — data layer
// ----------------------------------------------------------------------------
// Every request in this module starts from the shop identifier in the URL.
// Requests A (seller) and C (categories) are resolved from `sellers`/`products`
// directly; request B (products page) needs the seller id when the URL carries a
// shop slug (see fetchSeller), so it is enabled as soon as the seller resolves.
// ============================================================================

/** Bucket that holds product images (written by the product creation RPCs). */
const PRODUCT_IMAGES_BUCKET = 'productImages';

/** Upper bound for the slug fallback scan so a bad URL can never pull the whole table. */
const MAX_SELLER_SCAN = 1000;

/** Product cards per page (existing infinite scroll page size). */
export const STOREFRONT_PAGE_SIZE = 8;

/** Shared TanStack Query timing: 5-minute cache, 10-minute gcTime. */
export const STOREFRONT_STALE_TIME = 5 * 60 * 1000;
export const STOREFRONT_GC_TIME = 10 * 60 * 1000;

/** Used when a product has no thumbnail row at all. */
export const STOREFRONT_PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=800&auto=format&fit=crop';

export type StorefrontSort = 'low-to-high' | 'high-to-low' | '';

/** Request A shape: only the columns the header can display. */
export interface StorefrontSeller {
  id: string;
  shop_name: string;
  status: string | null;
  store_image_url: string | null;
  average_rating: number | null;
  review_count: number | null;
  created_at: string | null;
}

export interface StorefrontCategoryRef {
  id: string;
  name: string;
}

export interface StorefrontCategoryGroup {
  name: string;
  ids: string[];
}

/** Raw embedded rows of request B. */
export interface StorefrontProductImageRow {
  storage_path: string | null;
  image_url: string | null;
  alt_text: string | null;
}

export interface StorefrontReviewRow {
  rating: number | null;
}

/** Request B shape: one row per product, with thumbnail and approved ratings embedded. */
export interface StorefrontProduct {
  id: string;
  title: string | null;
  inventory_mode: string | null;
  selling_price: number | null;
  compare_at_price: number | null;
  cached_min_variant_price: number | null;
  cached_max_variant_price: number | null;
  category_id: string | null;
  created_at: string | null;
  /** Cached rating columns (may be absent from the live schema). */
  average_rating: number | null;
  review_count: number | null;
  product_images: StorefrontProductImageRow[] | null;
  reviews: StorefrontReviewRow[] | null;
}

export interface StorefrontProductsPage {
  products: StorefrontProduct[];
  count: number;
}

export interface FetchSellerProductsParams {
  sellerId: string;
  /** 1-based page index. */
  page: number;
  sort: StorefrontSort;
  /**
   * `null`/`undefined` means "all categories". An empty array means the selected
   * chip resolved to no categories, so the page is legitimately empty.
   */
  categoryIds?: string[] | null;
}

// ============================================================================
// Small shared helpers
// ============================================================================

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Reads a column that the live schema may or may not expose yet. */
interface QueryErrorLike {
  code?: string | null;
  message?: string | null;
}

function isUnknownColumnError(error: QueryErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const message = String(error.message || '');
  return /column .* does not exist|could not find the '.*' column/i.test(message);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Decodes and trims the URL segment exactly once. */
export function normalizeShopIdentifier(raw: string | null | undefined): string {
  const value = typeof raw === 'string' ? raw : '';
  if (!value) return '';
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

/**
 * Canonical storefront URLs are the shop name with whitespace removed
 * ("The Economy Store" -> "theeconomystore"). Hyphens/underscores are ignored as
 * well so `/muasam-collection` still finds "Muasam Collection".
 */
export function toShopSlug(value: string): string {
  return value.toLowerCase().replace(/[\s\-_]+/g, '');
}

/**
 * Escapes the PostgREST/`LIKE` wildcards so a shop name containing `%`, `_`, `*`
 * or `\` matches only itself.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_*]/g, (match) => `\\${match}`);
}

/**
 * PostgREST splits filter values on `,` and reads `()` as operators, so values that
 * contain them are sent double-quoted.
 */
function quoteFilterValue(value: string): string {
  return /[",()]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/** Only an approved/active seller owns a live storefront. */
export function isActiveSellerStatus(status: string | null | undefined): boolean {
  return trimString(status).toLowerCase() === 'active';
}

// ============================================================================
// Request A — seller
// ============================================================================

const SELLER_COLUMNS = 'id, shop_name, status, store_image_url, average_rating, review_count, created_at';
/** `review_count` is not used anywhere else in the codebase, so it may be absent. */
const SELLER_COLUMNS_FALLBACK = 'id, shop_name, status, store_image_url, average_rating, created_at';

type SellerLookup = { kind: 'id'; value: string } | { kind: 'name'; value: string };

function normalizeSellerRow(raw: Record<string, unknown> | null | undefined): StorefrontSeller | null {
  if (!raw) return null;
  const id = trimString(raw.id);
  if (!id) return null;
  return {
    id,
    shop_name: trimString(raw.shop_name),
    status: typeof raw.status === 'string' ? raw.status : null,
    store_image_url: trimString(raw.store_image_url) || null,
    average_rating: toFiniteNumber(raw.average_rating),
    review_count: toFiniteNumber(raw.review_count),
    created_at: typeof raw.created_at === 'string' ? raw.created_at : null,
  };
}

async function querySeller(lookup: SellerLookup, columns: string) {
  const selected = supabase.from('sellers').select<string, Record<string, unknown>>(columns);
  const filtered =
    lookup.kind === 'id'
      ? selected.eq('id', lookup.value)
      : selected.ilike('shop_name', quoteFilterValue(escapeLike(lookup.value)));

  // `.limit(1)` + `maybeSingle()`: a duplicated shop name can never throw,
  // and zero rows resolve to `null` instead of an error.
  return await filtered.order('created_at', { ascending: true }).limit(1).maybeSingle();
}

async function lookupSeller(lookup: SellerLookup): Promise<StorefrontSeller | null> {
  let result = await querySeller(lookup, SELLER_COLUMNS);

  if (result.error && isUnknownColumnError(result.error)) {
    result = await querySeller(lookup, SELLER_COLUMNS_FALLBACK);
  }
  if (result.error) throw result.error;

  return normalizeSellerRow(result.data);
}

async function lookupSellerBySlug(identifier: string): Promise<StorefrontSeller | null> {
  const slug = toShopSlug(identifier);
  if (!slug) return null;

  let result = await supabase
    .from('sellers')
    .select<string, Record<string, unknown>>(SELLER_COLUMNS)
    .limit(MAX_SELLER_SCAN);

  if (result.error && isUnknownColumnError(result.error)) {
    result = await supabase
      .from('sellers')
      .select<string, Record<string, unknown>>(SELLER_COLUMNS_FALLBACK)
      .limit(MAX_SELLER_SCAN);
  }
  if (result.error) throw result.error;

  const rows: Record<string, unknown>[] = Array.isArray(result.data) ? result.data : [];
  for (const row of rows) {
    const shopName = trimString(row?.shop_name);
    if (shopName && toShopSlug(shopName) === slug) {
      return normalizeSellerRow(row);
    }
  }
  return null;
}

/**
 * Resolves the seller behind the URL segment.
 *
 * Order: UUID (`/store/{id}` links) -> case-insensitive exact `shop_name` ->
 * canonical slug. The exact match is tried first so a well-formed shop URL costs
 * a single tiny request.
 */
export async function fetchSeller(identifier: string): Promise<StorefrontSeller | null> {
  const decoded = normalizeShopIdentifier(identifier);
  if (!decoded) return null;

  if (isUuid(decoded)) {
    return await lookupSeller({ kind: 'id', value: decoded });
  }

  const exact = await lookupSeller({ kind: 'name', value: decoded });
  if (exact) return exact;

  return await lookupSellerBySlug(decoded);
}

// ============================================================================
// Request B — products page
// ============================================================================

// `product_images` and `reviews` are embedded WITHOUT `!inner` on purpose:
// an inner join would drop products that have no thumbnail or no approved review.
// The `.eq(...)` filters below therefore affect only the embedded rows.
const PRODUCT_COLUMNS = `
  id, title, inventory_mode, selling_price, compare_at_price,
  cached_min_variant_price, cached_max_variant_price, category_id, created_at,
  average_rating, review_count,
  product_images ( storage_path, image_url, alt_text ),
  reviews ( rating )
`;

/** Same page without the cached rating columns, used when they are not in the schema. */
const PRODUCT_COLUMNS_FALLBACK = `
  id, title, inventory_mode, selling_price, compare_at_price,
  cached_min_variant_price, cached_max_variant_price, category_id, created_at,
  product_images ( storage_path, image_url, alt_text ),
  reviews ( rating )
`;

/**
 * One request per page: thumbnail, category and approved ratings arrive together,
 * so cards never flicker in field by field.
 */
export async function fetchSellerProducts({
  sellerId,
  page,
  sort,
  categoryIds = null,
}: FetchSellerProductsParams): Promise<StorefrontProductsPage> {
  if (!sellerId) return { products: [], count: 0 };
  // A selected chip whose name maps to no category must not silently show everything.
  if (Array.isArray(categoryIds) && categoryIds.length === 0) return { products: [], count: 0 };

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * STOREFRONT_PAGE_SIZE;
  const to = from + STOREFRONT_PAGE_SIZE - 1;

  const runPageQuery = (columns: string) => {
    let pageQuery = supabase
      .from('products')
      .select<string, StorefrontProduct>(columns, { count: 'exact' })
      .eq('seller_id', sellerId)
      // Without this filter drafts, inactive and archived products are public.
      .eq('status', 'active')
      .eq('product_images.is_thumbnail', true)
      .eq('reviews.status', 'Approved');

    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      // Bounded by the number of categories sharing a chip name, never by the page size.
      pageQuery = pageQuery.in('category_id', categoryIds);
    }

    if (sort === 'low-to-high') {
      pageQuery = pageQuery
        .order('selling_price', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });
    } else if (sort === 'high-to-low') {
      pageQuery = pageQuery
        .order('selling_price', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });
    } else {
      pageQuery = pageQuery.order('created_at', { ascending: false }).order('id', { ascending: false });
    }

    return pageQuery.range(from, to);
  };

  let result = await runPageQuery(PRODUCT_COLUMNS);
  if (result.error && isUnknownColumnError(result.error)) {
    result = await runPageQuery(PRODUCT_COLUMNS_FALLBACK);
  }

  const { data, count, error } = result;

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (error.code === 'PGRST103' || message.includes('416') || message.includes('range')) {
      // Scrolling past the last row is not a failure.
      return { products: [], count: 0 };
    }
    throw error;
  }

  return {
    products: Array.isArray(data) ? data : [],
    count: typeof count === 'number' ? count : 0,
  };
}

// ============================================================================
// Request C — category chips
// ============================================================================

/**
 * Unique categories that the seller actually has active products in.
 * Only ids and names are transferred, so the payload stays tiny.
 */
export async function fetchSellerCategories(sellerId: string): Promise<StorefrontCategoryRef[]> {
  if (!sellerId) return [];

  const { data, error } = await supabase
    .from('products')
    .select('category:categories!products_category_fk ( id, name )')
    .eq('seller_id', sellerId)
    .eq('status', 'active');

  if (error) throw error;

  const unique = new Map<string, StorefrontCategoryRef>();

  for (const row of Array.isArray(data) ? data : []) {
    // PostgREST returns a to-one embed as either an object or a one-element array.
    const embedded = (row as { category?: unknown })?.category;
    const list = Array.isArray(embedded) ? embedded : embedded ? [embedded] : [];

    for (const item of list) {
      const category = item as { id?: unknown; name?: unknown };
      const id = trimString(category?.id);
      const name = trimString(category?.name);
      if (id && name && !unique.has(id)) {
        unique.set(id, { id, name });
      }
    }
  }

  return Array.from(unique.values());
}

/**
 * Groups categories by name: two categories can share a name under different
 * departments, and one chip must filter by every id carrying that name.
 */
export function groupCategoriesByName(
  categories: StorefrontCategoryRef[] | null | undefined
): StorefrontCategoryGroup[] {
  const groups = new Map<string, StorefrontCategoryGroup>();

  for (const category of categories || []) {
    const id = trimString(category?.id);
    const name = trimString(category?.name);
    if (!id || !name) continue;

    const key = name.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      if (!existing.ids.includes(id)) existing.ids.push(id);
    } else {
      groups.set(key, { name, ids: [id] });
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// Price resolution — the only place that knows about inventory_mode
// ============================================================================

export interface StorefrontPriceFields {
  inventory_mode: string | null;
  selling_price: number | null;
  compare_at_price: number | null;
  cached_min_variant_price: number | null;
  cached_max_variant_price: number | null;
}

export type ResolvedPrice =
  | { kind: 'single'; price: number }
  | { kind: 'sale'; price: number; original: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'pending' }
  | { kind: 'unavailable' };

/**
 * `simple` reads `selling_price`; `variants` reads the cached min/max columns and
 * never `selling_price` (it is NULL by constraint for variants).
 */
export function resolveProductPrice(product: StorefrontPriceFields): ResolvedPrice {
  if (product.inventory_mode === 'variants') {
    const min = toFiniteNumber(product.cached_min_variant_price);
    const max = toFiniteNumber(product.cached_max_variant_price);

    // Broken cache on an otherwise valid variant product: the fallback request fills it.
    if (min === null || max === null) return { kind: 'pending' };
    if (min === max) return { kind: 'single', price: min };

    return min < max ? { kind: 'range', min, max } : { kind: 'range', min: max, max: min };
  }

  const price = toFiniteNumber(product.selling_price);
  if (price === null) return { kind: 'unavailable' };

  const compareAt = toFiniteNumber(product.compare_at_price);
  if (compareAt !== null && compareAt > price) {
    return { kind: 'sale', price, original: compareAt };
  }

  return { kind: 'single', price };
}

/** Variant products whose cached prices are missing, so the fallback request can fill them. */
export function collectPendingVariantIds(products: StorefrontProduct[] | null | undefined): string[] {
  const ids: string[] = [];
  for (const product of products || []) {
    if (product?.inventory_mode !== 'variants') continue;
    if (!trimString(product.id)) continue;
    if (resolveProductPrice(product).kind === 'pending') ids.push(product.id);
  }
  return ids;
}

/**
 * Rare fallback: variants of the few products whose cached prices are null.
 * Only `product_id` and `selling_price` of the affected ids are requested.
 */
export async function fetchVariantPrices(
  productIds: string[]
): Promise<Record<string, { min: number; max: number }>> {
  const ids = Array.from(new Set((productIds || []).map(trimString).filter(Boolean)));
  const prices: Record<string, { min: number; max: number }> = {};
  if (ids.length === 0) return prices;

  const { data, error } = await supabase
    .from('product_variants')
    .select('product_id, selling_price')
    .in('product_id', ids)
    .eq('is_active', true);

  if (error) throw error;

  for (const row of Array.isArray(data) ? data : []) {
    const productId = trimString((row as { product_id?: unknown })?.product_id);
    const price = toFiniteNumber((row as { selling_price?: unknown })?.selling_price);
    if (!productId || price === null) continue;

    const current = prices[productId];
    if (!current) {
      prices[productId] = { min: price, max: price };
    } else {
      current.min = Math.min(current.min, price);
      current.max = Math.max(current.max, price);
    }
  }

  return prices;
}

// ============================================================================
// Card helpers
// ============================================================================

/**
 * The one thumbnail of a product: `image_url` first, then the public URL built
 * from `storage_path`. Still guards against duplicate rows.
 */
export function pickThumbnailUrl(
  images: StorefrontProductImageRow[] | null | undefined
): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;

  const first = images[0];
  if (!first) return null;

  const directUrl = trimString(first.image_url);
  if (directUrl) return directUrl;

  const storagePath = trimString(first.storage_path);
  if (!storagePath) return null;

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

/** Average of the embedded approved reviews; `null` when there are none. */
export function summarizeRatings(
  reviews: StorefrontReviewRow[] | null | undefined
): { average: number | null; count: number } {
  if (!Array.isArray(reviews) || reviews.length === 0) return { average: null, count: 0 };

  let sum = 0;
  let count = 0;

  for (const review of reviews) {
    const rating = toFiniteNumber(review?.rating);
    if (rating === null) continue;
    sum += rating;
    count += 1;
  }

  if (count === 0) return { average: null, count: 0 };
  return { average: sum / count, count };
}
