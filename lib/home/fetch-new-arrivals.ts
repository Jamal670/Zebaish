import { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { getCategoryAndDescendantIds } from '@/lib/categories/get-category-ids';

export interface NewArrivalProduct {
  id: string;
  title: string;
  price: number | null;
  shopName: string;
  imageUrl: string | null;
  imageAlt: string;
}

/**
 * Fetches the 7 latest active products for a category and all of its subcategories.
 * Selects selling_price and cached_min_variant_price for display.
 * Joins sellers for shop_name and product_images for thumbnail image.
 */
export async function fetchNewArrivals(
  supabase: SupabaseClient,
  slugOrClient: string | QueryClient,
  signalOrSlug?: AbortSignal | string,
  clientOrSignal?: QueryClient | AbortSignal
): Promise<NewArrivalProduct[]> {
  let slug: string;
  let queryClient: QueryClient | undefined;
  let signal: AbortSignal | undefined;

  if (typeof slugOrClient === 'string') {
    slug = slugOrClient;
    if (signalOrSlug instanceof AbortSignal) {
      signal = signalOrSlug;
    }
    if (clientOrSignal instanceof QueryClient) {
      queryClient = clientOrSignal;
    } else if (clientOrSignal instanceof AbortSignal) {
      signal = clientOrSignal;
    }
  } else {
    queryClient = slugOrClient;
    slug = typeof signalOrSlug === 'string' ? signalOrSlug : '';
    if (clientOrSignal instanceof AbortSignal) {
      signal = clientOrSignal;
    }
  }

  if (!slug) return [];

  // Use provided QueryClient or create a fallback instance for category tree caching
  const effectiveQueryClient = queryClient || new QueryClient();
  const categoryIds = await getCategoryAndDescendantIds(supabase, effectiveQueryClient, slug);

  if (!categoryIds || categoryIds.length === 0) {
    return [];
  }

  let query = supabase
    .from('products')
    .select(`
      id, title, selling_price, cached_min_variant_price,
      sellers!inner ( shop_name ),
      product_images ( image_url, storage_path, alt_text, is_thumbnail )
    `)
    .eq('status', 'active')
    .in('category_id', categoryIds)
    .eq('product_images.is_thumbnail', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(7);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    // If the error was an intentional abort, rethrow or return empty
    if (signal?.aborted) return [];
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row: any) => {
    const images = Array.isArray(row.product_images) ? row.product_images : [];
    const thumb = images.find((img: any) => img.is_thumbnail) || images[0] || null;

    let imageUrl: string | null = null;
    if (thumb?.image_url) {
      imageUrl = thumb.image_url;
    } else if (thumb?.storage_path) {
      const { data: storageData } = supabase.storage
        .from('productImages')
        .getPublicUrl(thumb.storage_path.trim());
      imageUrl = storageData?.publicUrl || null;
    }

    const sellerData = Array.isArray(row.sellers) ? row.sellers[0] : row.sellers;
    const shopName = sellerData?.shop_name || 'Verified Seller';
    const imageAlt = thumb?.alt_text || row.title || 'Product image';

    // Price logic: selling_price, or cached_min_variant_price if selling_price is null
    const rawPrice = row.selling_price ?? row.cached_min_variant_price ?? null;
    const price = rawPrice !== null && rawPrice !== undefined ? Number(rawPrice) : null;

    return {
      id: row.id,
      title: row.title,
      price,
      shopName,
      imageUrl,
      imageAlt,
    };
  });
}
