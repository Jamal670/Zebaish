import supabase from './client';

export interface ProductEditCoreData {
  id: string;
  seller_id: string;
  category_id: string | null;
  title: string | null;
  description: string | null;
  condition_details: string | null;
  inventory_mode: 'simple' | 'variants' | null;
  selling_price: number | null;
  compare_at_price: number | null;
  quantity: number | null;
  status: string | null;
  updated_at: string | null;
  category?: {
    id: string;
    name: string;
    parent_id: string | null;
    is_active?: boolean;
    /** PostgREST may return the self-referencing embed as an object or an array */
    parent?: { id: string; name: string } | { id: string; name: string }[] | null;
  } | null;
  product_images?: Array<{
    id: string;
    storage_path: string | null;
    image_url: string | null;
    alt_text: string | null;
    is_thumbnail: boolean | null;
    display_order: number | null;
  }>;
}

export interface ProductEditAttributesData {
  attributeValues: any[];
  customAttributes: Array<{
    id: string;
    name: string;
    value: string;
    display_order?: number;
  }>;
}

export interface ProductEditVariationsData {
  options: any[];
  variants: any[];
}

export interface ProductOptionImageData {
  id: string;
  product_option_value_id: string;
  storage_path: string;
  image_url: string;
  created_at: string;
}

/**
 * Section Core Fetcher: product, images, category and parent
 */
export async function fetchSectionCore(
  productId: string,
  sellerId: string,
  signal?: AbortSignal
): Promise<ProductEditCoreData | null> {
  try {
    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories!products_category_fk (
          id, name, parent_id, is_active,
          parent:categories!parent_id ( id, name )
        ),
        product_images ( id, storage_path, image_url, alt_text, is_thumbnail, display_order )
      `)
      .eq('id', productId)
      .eq('seller_id', sellerId)
      .order('display_order', { referencedTable: 'product_images' });

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      if (
        error.code === 'PGRST200' ||
        error.code === 'PGRST201' ||
        error.message?.includes('relationship') ||
        error.message?.includes('parent') ||
        error.message?.includes('categories')
      ) {
        return await fetchSectionCoreFallback(productId, sellerId, signal);
      }
      throw error;
    }
    return data ? await resolveCategoryParent(data, signal) : null;
  } catch (err: any) {
    if (signal?.aborted) throw err;
    if (
      err?.code === 'PGRST200' ||
      err?.code === 'PGRST201' ||
      err?.message?.includes('relationship') ||
      err?.message?.includes('parent') ||
      err?.message?.includes('categories')
    ) {
      return await fetchSectionCoreFallback(productId, sellerId, signal);
    }
    throw err;
  }
}

/**
 * PostgREST returns a self-referencing embed (`parent:categories!parent_id`) as an array,
 * which leaves the department name empty on the edit screen. Flattens it to a single
 * object and fetches the parent row explicitly when the embed came back empty.
 */
async function resolveCategoryParent(
  data: ProductEditCoreData,
  signal?: AbortSignal
): Promise<ProductEditCoreData> {
  const cat = data.category;
  if (!cat) return data;

  const rawParent = cat.parent as any;
  const embeddedParent = Array.isArray(rawParent) ? rawParent[0] || null : rawParent || null;

  if (embeddedParent) {
    return { ...data, category: { ...cat, parent: embeddedParent } };
  }
  if (!cat.parent_id) {
    return { ...data, category: { ...cat, parent: null } };
  }

  let parentQuery = supabase
    .from('categories')
    .select('id, name')
    .eq('id', cat.parent_id);

  if (signal) {
    parentQuery = parentQuery.abortSignal(signal);
  }

  const { data: parentRow } = await parentQuery.maybeSingle();

  return {
    ...data,
    category: {
      ...cat,
      parent: parentRow ? { id: parentRow.id, name: parentRow.name } : null,
    },
  };
}

async function fetchSectionCoreFallback(
  productId: string,
  sellerId: string,
  signal?: AbortSignal
): Promise<ProductEditCoreData | null> {
  let prodQuery = supabase
    .from('products')
    .select(`
      *,
      product_images ( id, storage_path, image_url, alt_text, is_thumbnail, display_order )
    `)
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .order('display_order', { referencedTable: 'product_images' });

  if (signal) {
    prodQuery = prodQuery.abortSignal(signal);
  }

  const { data: prod, error: prodErr } = await prodQuery.maybeSingle();

  if (prodErr) throw prodErr;
  if (!prod) return null;

  if (prod.category_id) {
    let catQuery = supabase
      .from('categories')
      .select('id, name, parent_id, is_active')
      .eq('id', prod.category_id);

    if (signal) {
      catQuery = catQuery.abortSignal(signal);
    }

    const { data: catData } = await catQuery.maybeSingle();

    if (catData) {
      let parentCat: { id: string; name: string } | null = null;
      if (catData.parent_id) {
        let pQuery = supabase
          .from('categories')
          .select('id, name')
          .eq('id', catData.parent_id);

        if (signal) {
          pQuery = pQuery.abortSignal(signal);
        }

        const { data: pData } = await pQuery.maybeSingle();
        if (pData) parentCat = pData;
      }
      prod.category = {
        ...catData,
        parent: parentCat,
      };
    }
  }

  return prod;
}

/**
 * Section Attributes Fetcher: category attribute values and custom specs
 */
export async function fetchSectionAttributes(
  productId: string,
  signal?: AbortSignal
): Promise<ProductEditAttributesData> {
  const [attrValuesRes, customAttrsRes] = await Promise.all([
    (async () => {
      try {
        let pavQuery = supabase
          .from('product_attribute_values')
          .select(`
            id, attribute_id, value_text, value_number, value_boolean, value_jsonb,
            category_attribute_definitions ( id, name, slug, data_type, options, is_required, is_active, sort_order )
          `)
          .eq('product_id', productId);

        if (signal) {
          pavQuery = pavQuery.abortSignal(signal);
        }

        const { data, error } = await pavQuery;

        if (error) {
          if (
            error.code === 'PGRST200' ||
            error.code === 'PGRST201' ||
            error.message?.includes('relationship') ||
            error.message?.includes('category_attribute_definitions')
          ) {
            return await fetchAttributeValuesFallback(productId, signal);
          }
          throw error;
        }

        const list = data || [];
        const missingIds = list
          .filter((av: any) => {
            const defObj = av.category_attribute_definitions;
            const hasName = Array.isArray(defObj) ? Boolean(defObj[0]?.name) : Boolean(defObj?.name);
            return av.attribute_id && !hasName;
          })
          .map((av: any) => av.attribute_id);

        if (missingIds.length > 0) {
          let defsQuery = supabase
            .from('category_attribute_definitions')
            .select('id, name, slug, data_type, options, is_required, is_active, sort_order')
            .in('id', missingIds);

          if (signal) {
            defsQuery = defsQuery.abortSignal(signal);
          }

          const { data: defs } = await defsQuery;

          if (defs) {
            const defMap = new Map(defs.map((d: any) => [d.id, d]));
            for (const av of list) {
              const defObj = (av as any).category_attribute_definitions;
              const hasName = Array.isArray(defObj) ? Boolean(defObj[0]?.name) : Boolean(defObj?.name);
              if (av.attribute_id && !hasName) {
                const def = defMap.get(av.attribute_id);
                if (def) (av as any).category_attribute_definitions = def;
              }
            }
          }
        }

        return list;
      } catch (err: any) {
        if (signal?.aborted) throw err;
        return await fetchAttributeValuesFallback(productId, signal);
      }
    })(),
    (async () => {
      let pcaQuery = supabase
        .from('product_custom_attributes')
        .select('id, name, value, display_order')
        .eq('product_id', productId)
        .order('display_order', { ascending: true });

      if (signal) {
        pcaQuery = pcaQuery.abortSignal(signal);
      }

      const { data, error } = await pcaQuery;

      if (error) throw error;
      return data || [];
    })(),
  ]);

  return {
    attributeValues: attrValuesRes,
    customAttributes: customAttrsRes,
  };
}

async function fetchAttributeValuesFallback(productId: string, signal?: AbortSignal) {
  let pavQuery = supabase
    .from('product_attribute_values')
    .select('id, attribute_id, value_text, value_number, value_boolean, value_jsonb')
    .eq('product_id', productId);

  if (signal) {
    pavQuery = pavQuery.abortSignal(signal);
  }

  const { data: pavList, error: pavError } = await pavQuery;

  if (pavError) throw pavError;
  const list = pavList || [];
  const attrIds = Array.from(new Set(list.map((av: any) => av.attribute_id).filter(Boolean)));

  if (attrIds.length > 0) {
    let defsQuery = supabase
      .from('category_attribute_definitions')
      .select('id, name, slug, data_type, options, is_required, is_active, sort_order')
      .in('id', attrIds);

    if (signal) {
      defsQuery = defsQuery.abortSignal(signal);
    }

    const { data: defs, error: defsError } = await defsQuery;

    if (!defsError && defs) {
      const defMap = new Map(defs.map((d: any) => [d.id, d]));
      for (const av of list) {
        const found = defMap.get(av.attribute_id);
        if (found) {
          (av as any).category_attribute_definitions = found;
        }
      }
    }
  }

  return list;
}

/**
 * Section Variations Fetcher: options, option values, variants, and variant option values
 */
export async function fetchSectionVariations(
  productId: string,
  signal?: AbortSignal
): Promise<ProductEditVariationsData> {
  let optionsQuery = supabase
    .from('product_options')
    .select(`
      id, name, display_order,
      product_option_values ( id, value, normalized_value, display_order )
    `)
    .eq('product_id', productId)
    .order('display_order', { ascending: true })
    .order('display_order', { referencedTable: 'product_option_values', ascending: true });

  let variantsQuery = supabase
    .from('product_variants')
    .select(`
      id, sku, combination_key, selling_price, compare_at_price, quantity, is_active,
      variant_option_values ( product_option_value_id )
    `)
    .eq('product_id', productId);

  if (signal) {
    optionsQuery = optionsQuery.abortSignal(signal);
    variantsQuery = variantsQuery.abortSignal(signal);
  }

  const [optionsRes, variantsRes] = await Promise.all([
    optionsQuery,
    variantsQuery,
  ]);

  if (optionsRes.error) throw optionsRes.error;
  if (variantsRes.error) throw variantsRes.error;

  return {
    options: optionsRes.data || [],
    variants: variantsRes.data || [],
  };
}

/**
 * Section Option Images Fetcher: variation option images by product_id
 */
export async function fetchSectionOptionImages(
  productId: string,
  signal?: AbortSignal
): Promise<ProductOptionImageData[]> {
  let query = supabase
    .from('product_option_images')
    .select('id, product_option_value_id, storage_path, image_url, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}
