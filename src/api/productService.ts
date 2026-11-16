import supabase from './client';
import { VariationConfig } from '@/components/reseller/context/ListingDraftContext';

export const MAX_PRODUCT_IMAGES = 10;
const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const STORAGE_BUCKET = 'productImages';
const UPLOAD_CONCURRENCY = 3;

export interface CreateProductInput {
  userId: string;
  categoryId: string;
  title: string;
  description?: string | null;
  defect?: string | null;
  galleryImages: Array<File | Blob | { file?: File; previewUrl?: string; url?: string }>;
  simple?: {
    sellingPrice: number;
    compareAtPrice?: number | null;
    quantity: number;
  } | null;
  specValues?: Record<string, any>;
  customSpecs?: Array<{ name: string; value: string }>;
  variationConfig?: VariationConfig | null;
}

export interface CreateProductResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface ProcessedImage {
  hash: string;
  file: Blob; // Original file bytes
  blob: Blob; // Compressed blob for upload
  ext: string;
  mimeType: string;
  storagePath: string;
  imageUrl: string;
}

/**
 * Safely deletes a storage object from the productImages bucket only if no other
 * row in public.product_images or public.product_option_images still references it.
 */
export async function safeDeleteProductImageStorageObject(
  storagePath: string,
  excludeImageRowId?: string
): Promise<boolean> {
  if (!storagePath || !storagePath.trim()) return false;
  const trimmedPath = storagePath.trim();

  try {
    // 1. Check if referenced in product_images (excluding specified row if provided)
    let imgQuery = supabase
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('storage_path', trimmedPath);

    if (excludeImageRowId) {
      imgQuery = imgQuery.neq('id', excludeImageRowId);
    }
    const { count: imgCount, error: imgErr } = await imgQuery;
    if (!imgErr && (imgCount ?? 0) > 0) {
      // Still referenced in product_images: do NOT delete storage object
      return false;
    }

    // 2. Check if referenced in product_option_images
    const { count: optImgCount, error: optErr } = await supabase
      .from('product_option_images')
      .select('id', { count: 'exact', head: true })
      .eq('storage_path', trimmedPath);

    if (!optErr && (optImgCount ?? 0) > 0) {
      // Still referenced in product_option_images: do NOT delete storage object
      return false;
    }

    // 3. No remaining references in either table: safely delete storage object
    const { error: removeErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([trimmedPath]);

    if (removeErr) {
      console.warn(`Failed to remove storage object ${trimmedPath}:`, removeErr.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Error during safe storage deletion for ${trimmedPath}:`, err);
    return false;
  }
}

/**
 * Resolves an image input (File, Blob, data URL, blob URL, or remote URL) to a Blob with mime type.
 */
async function resolveImageBlob(
  input: File | Blob | string | { file?: File; previewUrl?: string; url?: string }
): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  // If wrapped in object with .file
  if (input && typeof input === 'object' && !(input instanceof Blob)) {
    if ('file' in input && input.file instanceof File) {
      input = input.file;
    } else if ('previewUrl' in input && typeof input.previewUrl === 'string') {
      input = input.previewUrl;
    } else if ('url' in input && typeof input.url === 'string') {
      input = input.url;
    }
  }

  if (input instanceof File) {
    const ext = input.name.split('.').pop()?.toLowerCase() || 'jpg';
    return { blob: input, mimeType: input.type || 'image/jpeg', ext };
  }

  if (input instanceof Blob) {
    let ext = 'jpg';
    if (input.type.includes('png')) ext = 'png';
    else if (input.type.includes('webp')) ext = 'webp';
    return { blob: input, mimeType: input.type || 'image/jpeg', ext };
  }

  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      const match = input.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const b64Data = match[2];
        const byteCharacters = atob(b64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        let ext = 'jpg';
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        return { blob, mimeType, ext };
      }
    }

    // Remote or blob URL
    const res = await fetch(input);
    const blob = await res.blob();
    const mimeType = blob.type || 'image/jpeg';
    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    return { blob, mimeType, ext };
  }

  throw new Error('Unsupported image input type.');
}

/**
 * Validates, compresses and resizes an image on a browser canvas.
 * Disallows SVG. Caps max dimension at 2000px.
 */
async function compressImage(blob: Blob, mimeType: string, ext: string): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  if (mimeType.toLowerCase().includes('svg') || ext === 'svg') {
    throw new Error('SVG images are not allowed. Please use JPG, PNG, or WebP.');
  }

  if (blob.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new Error(`Image size exceeds the 10MB limit (${(blob.size / (1024 * 1024)).toFixed(1)}MB).`);
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { blob, mimeType, ext };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const maxDim = 2000;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({ blob, mimeType, ext });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Keep PNG if original is PNG, otherwise encode as JPEG for performance & size
        const targetFormat = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        const targetExt = mimeType === 'image/png' ? 'png' : 'jpg';

        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob) {
              resolve({
                blob: compressedBlob,
                mimeType: targetFormat,
                ext: targetExt,
              });
            } else {
              resolve({ blob, mimeType, ext });
            }
          },
          targetFormat,
          0.88
        );
      } catch (err) {
        console.warn('Canvas compression fallback to original image:', err);
        resolve({ blob, mimeType, ext });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ blob, mimeType, ext });
    };

    img.src = url;
  });
}

/**
 * Computes the SHA-256 hexadecimal hash of a Blob.
 */
async function computeSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digestBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Maps database and RPC errors to friendly user-facing messages.
 */
function formatDatabaseError(err: any): string {
  if (!err) return 'An unexpected error occurred while saving your collection.';
  const message = (err.message || err.error_description || String(err)).trim();
  const code = err.code;

  if (message.startsWith('VALIDATION:')) {
    return message.replace(/^VALIDATION:\s*/, '');
  }
  if (code === 'PGRST202' || message.includes('schema cache') || message.includes('Could not find the function')) {
    if (message.includes('update_product_with_changes')) {
      return 'Database function public.update_product_with_changes not found in schema cache. Please ensure the migration script (supabase/migrations/20261106_update_product_with_changes_rpc.sql) has been executed in your Supabase SQL editor.';
    }
    if (message.includes('create_product_with_variants')) {
      return 'Database function public.create_product_with_variants not found in schema cache. Please ensure the migration script (supabase/migrations/20261105_all_in_one_product_creation.sql) has been executed in your Supabase SQL editor.';
    }
    if (message.includes('delete_product')) {
      return 'Database function public.delete_product not found in schema cache. Please ensure the migration script (supabase/migrations/20261107_fix_product_deletion_rpc.sql) has been executed in your Supabase SQL editor.';
    }
    return `Database function not found in schema cache: ${message}. Please ensure the relevant migration script has been executed in your Supabase SQL editor.`;
  }
  if (message.includes('unique or exclusion constraint') || message.includes('ON CONFLICT')) {
    return 'Database function update required: Please run migration script supabase/migrations/20261106_fix_on_conflict_rpc.sql in your Supabase SQL editor.';
  }
  if (code === '23505' || message.includes('duplicate key') || message.includes('23505')) {
    return 'A listing or option with this information already exists. Please review your details.';
  }
  if (code === '23514' || message.includes('check constraint') || message.includes('23514')) {
    return 'Invalid collection data: One or more fields violate price, stock, or status requirements.';
  }
  if (code === '23503' || message.includes('foreign key') || message.includes('23503')) {
    return 'Reference error: The selected category or option is invalid or no longer exists.';
  }
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'Permission denied: You can only create and manage listings for your own seller account.';
  }

  return message;
}

/**
 * Orchestrates atomic product creation:
 * 1. Preflight validation
 * 2. SHA-256 hashing & deduplication of all gallery and variation images
 * 3. Browser-direct Storage upload with concurrency limit & rollback tracking
 * 4. Transactional RPC call create_product_with_variants
 * 5. Rollback or recovery on failure
 */
export async function createProduct(input: CreateProductInput): Promise<CreateProductResult> {
  const {
    userId,
    categoryId,
    title,
    description,
    defect,
    galleryImages,
    simple,
    specValues,
    customSpecs,
    variationConfig,
  } = input;

  // 1. Client Preflight Validation
  if (!userId) {
    throw new Error('Authentication required: Please log in to your seller account.');
  }

  if (!categoryId) {
    throw new Error('Please select a valid sub-category for your collection.');
  }

  const cleanTitle = (title || '').trim();
  if (cleanTitle.length < 3 || cleanTitle.length > 255) {
    throw new Error('Product title must be between 3 and 255 characters.');
  }

  if (!galleryImages || galleryImages.length === 0) {
    throw new Error('Please upload at least 1 image for your collection.');
  }

  if (galleryImages.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`Maximum ${MAX_PRODUCT_IMAGES} images allowed per collection.`);
  }

  // Derive inventory mode
  const enabledDimensions = (variationConfig?.dimensions || []).filter(
    (d) => d.enabled && d.values && d.values.length > 0
  );
  const isVariantMode = enabledDimensions.length > 0;

  if (isVariantMode) {
    if (enabledDimensions.length > 5) {
      throw new Error('A maximum of 5 variation dimensions is allowed.');
    }
    for (const dim of enabledDimensions) {
      if (dim.values.length > 20) {
        throw new Error(`Dimension "${dim.name}" exceeds the maximum of 20 values.`);
      }
    }
    const rows = variationConfig?.rows || [];
    if (rows.length === 0) {
      throw new Error('At least one variation combination row is required.');
    }
    if (rows.length > 100) {
      throw new Error('A maximum of 100 variation combinations is allowed.');
    }

    let totalVariantStock = 0;
    for (const r of rows) {
      const price = Number(r.price);
      const qty = Number(r.quantity);
      if (isNaN(price) || price <= 0) {
        throw new Error('Every variation must have a valid selling price greater than 0.');
      }
      if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
        throw new Error('Every variation quantity must be an integer >= 0.');
      }
      totalVariantStock += qty;
    }

    if (totalVariantStock <= 0) {
      throw new Error('Total stock across all variations must be greater than 0.');
    }
  } else {
    if (!simple) {
      throw new Error('Pricing and quantity details are required for simple products.');
    }
    if (isNaN(simple.sellingPrice) || simple.sellingPrice <= 0) {
      throw new Error('Selling price must be greater than 0.');
    }
    if (simple.compareAtPrice !== null && simple.compareAtPrice !== undefined) {
      if (simple.compareAtPrice < simple.sellingPrice) {
        throw new Error('Original retail price cannot be less than selling price.');
      }
    }
    if (isNaN(simple.quantity) || simple.quantity <= 0 || !Number.isInteger(simple.quantity)) {
      throw new Error('Product quantity must be an integer greater than 0.');
    }
  }

  // 2. Generate Product ID on client
  const productId = crypto.randomUUID();

  // 3. Process & Hash All Images using one shared Map<hash, ProcessedImage>
  // Identity = SHA-256 of the original file bytes (crypto.subtle.digest).
  // Single shared map covers both the gallery and every variation value.
  const imageMap = new Map<string, ProcessedImage>();

  // Helper: retrieves or processes an image input against the shared Map<hash, ProcessedImage>
  async function processImageToSharedMap(
    input: File | Blob | string | { file?: File; previewUrl?: string; url?: string }
  ): Promise<{ storagePath: string; imageUrl: string }> {
    // 1. Resolve original file bytes
    const original = await resolveImageBlob(input);
    // 2. Hash of the original file bytes
    const hash = await computeSha256(original.blob);

    let entry = imageMap.get(hash);
    if (!entry) {
      // 3. For each unique hash, run compression / conversion ONCE
      const compressed = await compressImage(original.blob, original.mimeType, original.ext);
      // Path = {userId}/{productId}/{hash}.{ext} (content-addressed location)
      const storagePath = `${userId}/${productId}/${hash}.${compressed.ext}`;
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

      entry = {
        hash,
        file: original.blob,
        blob: compressed.blob,
        ext: compressed.ext,
        mimeType: compressed.mimeType,
        storagePath,
        imageUrl: urlData.publicUrl,
      };
      imageMap.set(hash, entry);
    }

    return {
      storagePath: entry.storagePath,
      imageUrl: entry.imageUrl,
    };
  }

  // 3a. Process Gallery Images (only what seller currently has in galleryImages)
  const galleryImageRefs: { storagePath: string; imageUrl: string }[] = [];
  const galleryPathsSeen = new Set<string>();

  for (const rawImg of galleryImages) {
    const ref = await processImageToSharedMap(rawImg);
    // De-dupe gallery by path
    if (!galleryPathsSeen.has(ref.storagePath)) {
      galleryPathsSeen.add(ref.storagePath);
      galleryImageRefs.push({
        storagePath: ref.storagePath,
        imageUrl: ref.imageUrl,
      });
    }
  }

  // 3b. Process Variation Images (strictly from final payload dimensions & active values)
  // - A value that was removed in the UI must not upload its image.
  // - A value of a deselected dimension must not upload or save its image.
  const optionValueImageMap = new Map<string, { storagePath: string; imageUrl: string }>();

  if (isVariantMode) {
    // ONLY iterate over enabled dimensions and active values in those dimensions
    for (const dim of enabledDimensions) {
      for (const val of dim.values) {
        const trimmedVal = val.trim();
        const normKey = `${dim.name.trim().toLowerCase()}::${trimmedVal.toLowerCase()}`;

        // 1. Check valueImages (stores File directly)
        const fileEntry = variationConfig?.valueImages?.[normKey];
        const rawFile = fileEntry?.file;

        // 2. Legacy fallback
        const legacyOptImg =
          variationConfig?.dimensionImages?.[dim.name]?.[val]?.[0] ||
          variationConfig?.dimensionImages?.[dim.name]?.[trimmedVal]?.[0];

        const targetImg = rawFile || legacyOptImg;

        if (targetImg) {
          try {
            const ref = await processImageToSharedMap(targetImg);
            optionValueImageMap.set(normKey, {
              storagePath: ref.storagePath,
              imageUrl: ref.imageUrl,
            });
            optionValueImageMap.set(`${dim.name}::${trimmedVal}`, {
              storagePath: ref.storagePath,
              imageUrl: ref.imageUrl,
            });
          } catch (err) {
            console.warn(`Failed to process variation image for ${dim.name}:${trimmedVal}`, err);
          }
        }
      }
    }
  }

  // 4. Concurrently Upload Unique Images (1 upload per unique SHA-256 hash)
  // Limit upload concurrency to 3 to 4 and use Promise.allSettled
  const uniqueItems = Array.from(imageMap.values());
  const uploadedPaths: string[] = [];
  let uploadError: any = null;

  let currentIndex = 0;
  async function uploadWorker() {
    while (currentIndex < uniqueItems.length && !uploadError) {
      const taskIndex = currentIndex++;
      const item = uniqueItems[taskIndex];

      try {
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(item.storagePath, item.blob, {
            contentType: item.mimeType,
            cacheControl: '31536000',
            upsert: false,
          });

        if (upErr) {
          throw new Error(upErr.message || 'Image storage upload failed.');
        }

        // Record each successfully uploaded path of THIS attempt for cleanup
        uploadedPaths.push(item.storagePath);
      } catch (err: any) {
        uploadError = err;
        break;
      }
    }
  }

  const workerCount = Math.min(UPLOAD_CONCURRENCY, uniqueItems.length);
  const workers = Array.from({ length: workerCount }, () => uploadWorker());
  await Promise.allSettled(workers);

  if (uploadError) {
    // Rollback uploaded paths of this attempt
    if (uploadedPaths.length > 0) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
      } catch (cleanupErr) {
        console.error('Failed to clean up storage after upload error:', cleanupErr);
      }
    }
    throw new Error(`Image upload failed: ${uploadError?.message || 'Storage error'}`);
  }

  // 5. Construct Payload Matching RPC Contract (Section 5)
  // Custom specifications -> product_custom_attributes
  const customSpecsPayload = (customSpecs || [])
    .map((s) => ({
      name: s.name.trim(),
      value: s.value.trim(),
    }))
    .filter((s) => s.name.length > 0 && s.value.length > 0);

  // Category attribute values -> product_attribute_values
  const attributeValuesPayload: Array<{ attributeId: string; value: any }> = [];
  if (specValues) {
    for (const [attrId, val] of Object.entries(specValues)) {
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val)) {
          if (val.length > 0) {
            attributeValuesPayload.push({ attributeId: attrId, value: val });
          }
        } else {
          attributeValuesPayload.push({ attributeId: attrId, value: val });
        }
      }
    }
  }

  // Options & Variants payload
  let optionsPayload: any[] = [];
  let variantsPayload: any[] = [];

  if (isVariantMode) {
    optionsPayload = enabledDimensions.map((dim) => ({
      name: dim.name.trim(),
      values: dim.values.map((v) => {
        const trimmedVal = v.trim();
        const normKey = `${dim.name.trim().toLowerCase()}::${trimmedVal.toLowerCase()}`;
        const img =
          optionValueImageMap.get(normKey) ||
          optionValueImageMap.get(`${dim.name}::${trimmedVal}`) ||
          optionValueImageMap.get(`${dim.name}::${v}`);
        return {
          value: trimmedVal,
          ...(img ? { image: img } : {}),
        };
      }),
    }));

    const rows = variationConfig?.rows || [];
    variantsPayload = rows.map((r) => {
      const rowValues = enabledDimensions.map((dim) => {
        const dimVal =
          r.attributes?.[dim.name] ||
          (dim.name.toLowerCase() === 'color' ? r.color : null) ||
          (dim.name.toLowerCase() === 'size' ? r.size : null) ||
          '';
        return String(dimVal).trim();
      });

      return {
        values: rowValues,
        sellingPrice: Number(r.price),
        quantity: Number(r.quantity),
      };
    });
  }

  const payload = {
    productId,
    categoryId,
    title: cleanTitle,
    description: description ? description.trim() : null,
    defect: defect ? defect.trim() : null,
    simple: isVariantMode
      ? null
      : {
          sellingPrice: Number(simple!.sellingPrice),
          compareAtPrice:
            simple!.compareAtPrice !== null && simple!.compareAtPrice !== undefined
              ? Number(simple!.compareAtPrice)
              : null,
          quantity: Number(simple!.quantity),
        },
    images: galleryImageRefs,
    customSpecs: customSpecsPayload,
    attributeValues: attributeValuesPayload,
    options: optionsPayload,
    variants: variantsPayload,
  };

  // 6. Execute Atomic Database RPC
  let rpcData: any = null;
  let rpcError: any = null;
  let isDefinitiveError = false;

  try {
    const { data, error } = await supabase.rpc('create_product_with_variants', {
      p_payload: payload,
    });

    if (error) {
      rpcError = error;
      isDefinitiveError = true;
    } else {
      rpcData = data;
    }
  } catch (netErr: any) {
    rpcError = netErr;
    isDefinitiveError = false;
  }

  // 7. Error Handling & Storage Cleanup
  if (rpcError) {
    // If unknown outcome (network error or timeout), check if product was actually created
    if (!isDefinitiveError) {
      try {
        const { data: existingProd } = await supabase
          .from('products')
          .select('id, status')
          .eq('id', productId)
          .maybeSingle();

        if (existingProd?.id) {
          // Product successfully created despite network timeout
          return {
            success: true,
            data: {
              product_id: productId,
              status: existingProd.status,
              recovered: true,
            },
          };
        }
      } catch (checkErr) {
        console.warn('Failed to verify product existence following network timeout:', checkErr);
      }
    }

    // Product was not created or transaction rolled back: remove this attempt's uploaded images
    let cleanupWarning: string | null = null;
    if (uploadedPaths.length > 0) {
      try {
        const { error: removeErr } = await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
        if (removeErr) {
          cleanupWarning = removeErr.message;
          console.error('Storage cleanup failure:', removeErr);
        }
      } catch (removeEx: any) {
        cleanupWarning = removeEx?.message || 'Storage cleanup exception';
        console.error('Storage cleanup exception:', removeEx);
      }
    }

    const friendlyMsg = formatDatabaseError(rpcError);
    if (cleanupWarning) {
      throw new Error(`${friendlyMsg} (Storage cleanup notice: ${cleanupWarning})`);
    }
    throw new Error(friendlyMsg);
  }

  return {
    success: true,
    data: rpcData,
  };
}

// ============================================================================
// PRODUCT INFORMATION QUERY (MODAL DETAILS)
// ============================================================================

export interface ProductInformationData {
  id: string;
  title: string | null;
  status: string | null;
  views: number | null;
  inventory_mode: string | null;
  selling_price: number | null;
  quantity: number | null;
  cached_min_variant_price: number | null;
  cached_max_variant_price: number | null;
  cached_total_variant_quantity: number | null;
  condition_details: string | null;
  description: string | null;
  product_custom_attributes: Array<{
    id: string;
    name: string;
    value: string;
    display_order: number;
  }>;
  product_attribute_values: Array<{
    id: string;
    attribute_id: string;
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    value_jsonb: any;
    category_attribute_definitions?: {
      name: string;
      data_type: string;
      sort_order: number | null;
    } | null;
  }>;
  product_variants: Array<{
    id: string;
    combination_key: string;
    selling_price: number | null;
    quantity: number | null;
    is_active: boolean;
  }>;
}

/**
 * Fetches product information including custom attributes, category attribute values,
 * and variants for the Product Information Modal.
 * Single query function with automated fallback for PostgREST relationship resilience.
 */
export async function fetchProductInformation(
  productId: string,
  sellerId: string
): Promise<ProductInformationData | null> {
  if (!productId || !sellerId) return null;

  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, title, status, views, inventory_mode,
        selling_price, quantity,
        cached_min_variant_price, cached_max_variant_price, cached_total_variant_quantity,
        condition_details, description,
        product_custom_attributes ( id, name, value, display_order ),
        product_attribute_values (
          id, attribute_id, value_text, value_number, value_boolean, value_jsonb,
          category_attribute_definitions ( name, data_type, sort_order )
        ),
        product_variants ( id, combination_key, selling_price, quantity, is_active )
      `)
      .eq('id', productId)
      .eq('seller_id', sellerId)
      .order('display_order', { referencedTable: 'product_custom_attributes' })
      .maybeSingle();

    if (error) {
      if (
        error.code === 'PGRST200' ||
        error.code === 'PGRST201' ||
        error.message?.includes('relationship') ||
        error.message?.includes('category_attribute_definitions')
      ) {
        console.warn('PostgREST embed of category_attribute_definitions failed, executing fallback query:', error.message);
        return await fetchProductInformationFallback(productId, sellerId);
      }
      throw error;
    }

    if (!data) return null;

    // Resolve any category_attribute_definitions that returned null despite having attribute_id
    const attrValues = (data.product_attribute_values || []) as any[];
    const missingDefIds = attrValues
      .filter((av) => av.attribute_id && (!av.category_attribute_definitions || !av.category_attribute_definitions.name))
      .map((av) => av.attribute_id);

    if (missingDefIds.length > 0) {
      const { data: defs, error: defsErr } = await supabase
        .from('category_attribute_definitions')
        .select('id, name, data_type, sort_order')
        .in('id', missingDefIds);

      if (!defsErr && defs) {
        const defMap = new Map(defs.map((d) => [d.id, d]));
        for (const av of attrValues) {
          if (av.attribute_id && (!av.category_attribute_definitions || !av.category_attribute_definitions.name)) {
            const def = defMap.get(av.attribute_id);
            if (def) {
              av.category_attribute_definitions = {
                name: def.name,
                data_type: def.data_type,
                sort_order: def.sort_order,
              };
            }
          }
        }
      }
    }

    return data as unknown as ProductInformationData;
  } catch (err: any) {
    if (
      err?.code === 'PGRST200' ||
      err?.code === 'PGRST201' ||
      err?.message?.includes('relationship') ||
      err?.message?.includes('category_attribute_definitions')
    ) {
      return await fetchProductInformationFallback(productId, sellerId);
    }
    throw err;
  }
}

/**
 * Fallback query function in case direct PostgREST embedding of category_attribute_definitions
 * fails due to composite FK schema cache resolution. Fetches definitions in parallel
 * inside the same queryFn, returning a single cached result.
 */
async function fetchProductInformationFallback(
  productId: string,
  sellerId: string
): Promise<ProductInformationData | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, title, status, views, inventory_mode,
      selling_price, quantity,
      cached_min_variant_price, cached_max_variant_price, cached_total_variant_quantity,
      condition_details, description,
      product_custom_attributes ( id, name, value, display_order ),
      product_attribute_values (
        id, attribute_id, value_text, value_number, value_boolean, value_jsonb
      ),
      product_variants ( id, combination_key, selling_price, quantity, is_active )
    `)
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .order('display_order', { referencedTable: 'product_custom_attributes' })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const attrValues = (data.product_attribute_values || []) as any[];
  const attrIds = Array.from(new Set(attrValues.map((av) => av.attribute_id).filter(Boolean)));

  if (attrIds.length > 0) {
    const { data: defs, error: defsError } = await supabase
      .from('category_attribute_definitions')
      .select('id, name, data_type, sort_order')
      .in('id', attrIds);

    if (!defsError && defs) {
      const defMap = new Map(defs.map((d) => [d.id, d]));
      for (const av of attrValues) {
        const def = defMap.get(av.attribute_id);
        if (def) {
          av.category_attribute_definitions = {
            name: def.name,
            data_type: def.data_type,
            sort_order: def.sort_order,
          };
        }
      }
    }
  }

  return data as unknown as ProductInformationData;
}

// ============================================================================
// PRODUCT EDIT & UPDATE SERVICE (STABLE IDS, CHANGE-ONLY WRITES)
// ============================================================================

export interface ProductEditData {
  id: string;
  seller_id: string;
  category_id: string;
  title: string;
  description: string | null;
  condition_details: string | null;
  status: string;
  inventory_mode: string;
  selling_price: number | null;
  compare_at_price: number | null;
  quantity: number | null;
  updated_at: string;
  category?: {
    id: string;
    name: string;
    parent_id?: string | null;
  } | null;
  department?: {
    id: string;
    name: string;
  } | null;
  product_images: Array<{
    id: string;
    storage_path: string;
    image_url: string;
    display_order: number;
    is_thumbnail: boolean;
  }>;
  product_custom_attributes: Array<{
    id: string;
    name: string;
    value: string;
    display_order: number;
  }>;
  product_attribute_values: Array<{
    id: string;
    attribute_id: string;
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    value_jsonb: any;
  }>;
  product_options: Array<{
    id: string;
    name: string;
    display_order: number;
    values: Array<{
      id: string;
      value: string;
      display_order: number;
      image?: {
        id: string;
        storage_path: string;
        image_url: string;
      } | null;
    }>;
  }>;
  product_variants: Array<{
    id: string;
    combination_key: string;
    sku: string | null;
    selling_price: number | null;
    compare_at_price: number | null;
    quantity: number | null;
    is_active: boolean;
    option_value_ids?: string[];
  }>;
}

export interface UpdateProductInput {
  productId: string;
  sellerId: string;
  expectedUpdatedAt?: string;
  categoryId?: string;
  title: string;
  description?: string | null;
  defect?: string | null;
  simple?: {
    sellingPrice: number;
    compareAtPrice?: number | null;
    quantity: number | { from: number; to: number };
  } | null;
  patch?: any;
  galleryImages: Array<
    | File
    | Blob
    | {
        id?: string;
        storage_path?: string;
        storagePath?: string;
        url?: string;
        imageUrl?: string;
        file?: File;
        previewUrl?: string;
        is_thumbnail?: boolean;
        isThumbnail?: boolean;
      }
  >;
  specValues?: Record<string, any>;
  customSpecs?: Array<{ id?: string; name: string; value: string }>;
  variationConfig?: VariationConfig | null;
  confirmDestructive?: boolean;
  optionImagesLoaded?: boolean;
}

export interface UpdateProductResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Fetches product and all child records for the edit screen.
 * Resolves category parentage (department) and links option images to option values.
 */
export async function fetchProductForEdit(
  productId: string,
  sellerId: string
): Promise<ProductEditData | null> {
  if (!productId || !sellerId) return null;

  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      seller_id,
      category_id,
      title,
      description,
      condition_details,
      status,
      inventory_mode,
      selling_price,
      compare_at_price,
      quantity,
      updated_at,
      product_images (
        id,
        storage_path,
        image_url,
        display_order,
        is_thumbnail
      ),
      product_custom_attributes (
        id,
        name,
        value,
        display_order
      ),
      product_attribute_values (
        id,
        attribute_id,
        value_text,
        value_number,
        value_boolean,
        value_jsonb
      ),
      product_options (
        id,
        name,
        display_order,
        product_option_values (
          id,
          value,
          normalized_value,
          display_order
        )
      ),
      product_option_images (
        id,
        product_option_value_id,
        storage_path,
        image_url
      ),
      product_variants (
        id,
        combination_key,
        sku,
        selling_price,
        compare_at_price,
        quantity,
        is_active,
        variant_option_values (
          option_id,
          product_option_value_id
        )
      )
    `)
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching product for edit:', error);
    throw error;
  }

  if (!data) return null;

  // 1. Resolve category and department names & IDs
  let category: { id: string; name: string; parent_id?: string | null } | null = null;
  let department: { id: string; name: string } | null = null;

  if (data.category_id) {
    const { data: catData } = await supabase
      .from('categories')
      .select('id, name, parent_id')
      .eq('id', data.category_id)
      .maybeSingle();

    if (catData) {
      category = { id: catData.id, name: catData.name, parent_id: catData.parent_id };
      if (catData.parent_id) {
        const { data: deptData } = await supabase
          .from('categories')
          .select('id, name')
          .eq('id', catData.parent_id)
          .maybeSingle();
        if (deptData) {
          department = { id: deptData.id, name: deptData.name };
        }
      }
    }
  }

  // 2. Sort images by display_order
  const sortedImages = ((data.product_images || []) as any[]).sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );

  // 3. Sort custom specs by display_order
  const sortedCustomSpecs = ((data.product_custom_attributes || []) as any[]).sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );

  // 4. Map option images to option values
  const optImgMap = new Map<string, any>();
  ((data.product_option_images || []) as any[]).forEach((img) => {
    if (img.product_option_value_id) {
      optImgMap.set(img.product_option_value_id, img);
    }
  });

  const sortedOptions = ((data.product_options || []) as any[])
    .map((opt) => ({
      ...opt,
      values: ((opt.product_option_values || []) as any[])
        .map((val) => ({
          ...val,
          image: optImgMap.get(val.id) || null,
        }))
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    }))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  // 5. Variants with linked option_value_ids
  const sortedVariants = ((data.product_variants || []) as any[]).map((v) => ({
    ...v,
    option_value_ids: ((v.variant_option_values || []) as any[]).map(
      (vov) => vov.product_option_value_id
    ),
  }));

  return {
    id: data.id,
    seller_id: data.seller_id,
    category_id: data.category_id,
    title: data.title,
    description: data.description,
    condition_details: data.condition_details,
    status: data.status,
    inventory_mode: data.inventory_mode,
    selling_price: data.selling_price,
    compare_at_price: data.compare_at_price,
    quantity: data.quantity,
    updated_at: data.updated_at,
    category,
    department,
    product_images: sortedImages,
    product_custom_attributes: sortedCustomSpecs,
    product_attribute_values: (data.product_attribute_values || []) as any[],
    product_options: sortedOptions,
    product_variants: sortedVariants,
  };
}

/**
 * Orchestrates atomic product update:
 * 1. Preflight validation
 * 2. Hash & upload only newly added images (preserving existing storage objects)
 * 3. Builds change payload matching update_product_with_changes RPC
 * 4. Calls update_product_with_changes atomically with optimistic concurrency check
 * 5. Executes post-commit storage cleanup of orphaned paths
 * 6. Handles rollback of newly uploaded paths on failure
 */
export async function updateProduct(input: UpdateProductInput): Promise<UpdateProductResult> {
  const {
    productId,
    sellerId,
    expectedUpdatedAt,
    categoryId,
    title,
    description,
    defect,
    galleryImages,
    simple,
    specValues,
    customSpecs,
    variationConfig,
    confirmDestructive,
    optionImagesLoaded,
  } = input;

  if (!productId || !sellerId) {
    throw new Error('Authentication required: Product ID and Seller ID are required.');
  }

  if (!categoryId) {
    throw new Error('Please select a valid sub-category for your collection.');
  }

  const cleanTitle = (title || '').trim();
  if (cleanTitle.length < 3 || cleanTitle.length > 255) {
    throw new Error('Product title must be between 3 and 255 characters.');
  }

  if (!galleryImages || galleryImages.length === 0) {
    throw new Error('Please keep or upload at least 1 image for your collection.');
  }

  if (galleryImages.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`Maximum ${MAX_PRODUCT_IMAGES} images allowed per collection.`);
  }

  // Derive inventory mode
  const enabledDimensions = (variationConfig?.dimensions || []).filter(
    (d) => d.enabled && d.values && d.values.length > 0
  );
  const isVariantMode = enabledDimensions.length > 0;

  if (isVariantMode) {
    if (enabledDimensions.length > 5) {
      throw new Error('A maximum of 5 variation dimensions is allowed.');
    }
    for (const dim of enabledDimensions) {
      if (dim.values.length > 20) {
        throw new Error(`Dimension "${dim.name}" exceeds the maximum of 20 values.`);
      }
    }
    const rows = variationConfig?.rows || [];
    if (rows.length === 0) {
      throw new Error('At least one variation combination row is required.');
    }
    if (rows.length > 100) {
      throw new Error('A maximum of 100 variation combinations is allowed.');
    }

    let totalVariantStock = 0;
    for (const r of rows) {
      const price = Number(r.price);
      const qty = Number(r.quantity);
      if (isNaN(price) || price <= 0) {
        throw new Error('Every variation must have a valid selling price greater than 0.');
      }
      if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
        throw new Error('Every variation quantity must be an integer >= 0.');
      }
      totalVariantStock += qty;
    }

    if (totalVariantStock <= 0) {
      throw new Error('Total stock across all variations must be greater than 0.');
    }
  } else {
    if (!simple) {
      throw new Error('Pricing and quantity details are required for simple products.');
    }
    if (isNaN(simple.sellingPrice) || simple.sellingPrice <= 0) {
      throw new Error('Selling price must be greater than 0.');
    }
    if (simple.compareAtPrice !== null && simple.compareAtPrice !== undefined) {
      if (simple.compareAtPrice < simple.sellingPrice) {
        throw new Error('Original retail price cannot be less than selling price.');
      }
    }
    if (isNaN(simple.quantity) || simple.quantity < 0 || !Number.isInteger(simple.quantity)) {
      throw new Error('Product quantity must be an integer greater than or equal to 0.');
    }
  }

  // Image Processing & Hashing
  // Shared Map for new files to upload
  const imageMap = new Map<string, ProcessedImage>();

  async function processNewFileToSharedMap(
    fileInput: File | Blob
  ): Promise<{ storagePath: string; imageUrl: string }> {
    const original = await resolveImageBlob(fileInput);
    const hash = await computeSha256(original.blob);

    let entry = imageMap.get(hash);
    if (!entry) {
      const compressed = await compressImage(original.blob, original.mimeType, original.ext);
      const storagePath = `${sellerId}/${productId}/${hash}.${compressed.ext}`;
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

      entry = {
        hash,
        file: original.blob,
        blob: compressed.blob,
        ext: compressed.ext,
        mimeType: compressed.mimeType,
        storagePath,
        imageUrl: urlData.publicUrl,
      };
      imageMap.set(hash, entry);
    }

    return {
      storagePath: entry.storagePath,
      imageUrl: entry.imageUrl,
    };
  }

  // Process Gallery Images (mix of existing and new)
  const galleryImageRefs: Array<{
    id?: string;
    storagePath: string;
    imageUrl: string;
    isThumbnail: boolean;
  }> = [];
  const galleryPathsSeen = new Set<string>();

  for (let idx = 0; idx < galleryImages.length; idx++) {
    const imgItem = galleryImages[idx];
    const isThumb = idx === 0;

    // Check if existing image record
    let existingPath: string | null = null;
    let existingUrl: string | null = null;
    let existingId: string | undefined = undefined;

    if (imgItem && typeof imgItem === 'object' && !(imgItem instanceof Blob)) {
      const it = imgItem as any;
      if (it.storage_path || it.storagePath) {
        existingPath = it.storage_path || it.storagePath;
        existingUrl = it.image_url || it.imageUrl || it.url;
        existingId = it.id;
      } else if (it.url && !it.file && !it.previewUrl?.startsWith('blob:')) {
        existingUrl = it.url;
        existingId = it.id;
      }
    }

    if (existingPath && existingUrl) {
      if (!galleryPathsSeen.has(existingPath)) {
        galleryPathsSeen.add(existingPath);
        galleryImageRefs.push({
          ...(existingId ? { id: existingId } : {}),
          storagePath: existingPath,
          imageUrl: existingUrl,
          isThumbnail: isThumb,
        });
      }
    } else {
      // Newly added file
      let rawFile: File | Blob | null = null;
      if (imgItem instanceof File || imgItem instanceof Blob) {
        rawFile = imgItem;
      } else if (imgItem && typeof imgItem === 'object' && (imgItem as any).file instanceof File) {
        rawFile = (imgItem as any).file;
      }

      if (rawFile) {
        const ref = await processNewFileToSharedMap(rawFile);
        if (!galleryPathsSeen.has(ref.storagePath)) {
          galleryPathsSeen.add(ref.storagePath);
          galleryImageRefs.push({
            storagePath: ref.storagePath,
            imageUrl: ref.imageUrl,
            isThumbnail: isThumb,
          });
        }
      }
    }
  }

  // Process Variation Images
  const optionValueImageMap = new Map<string, { storagePath: string; imageUrl: string }>();

  if (isVariantMode) {
    for (const dim of enabledDimensions) {
      for (const val of dim.values) {
        const trimmedVal = val.trim();
        const normKey = `${dim.name.trim().toLowerCase()}::${trimmedVal.toLowerCase()}`;
        const entry = variationConfig?.valueImages?.[normKey];

        if (entry) {
          if (entry.file instanceof File) {
            try {
              const ref = await processNewFileToSharedMap(entry.file);
              optionValueImageMap.set(normKey, ref);
            } catch (err) {
              console.warn(`Failed to process variation image file for ${dim.name}:${trimmedVal}`, err);
            }
          } else if (entry.storagePath && entry.imageUrl) {
            optionValueImageMap.set(normKey, {
              storagePath: entry.storagePath,
              imageUrl: entry.imageUrl,
            });
          }
        }
      }
    }
  }

  // Concurrently Upload Newly Added Images (1 upload per unique SHA-256 hash)
  const uniqueNewItems = Array.from(imageMap.values());
  const uploadedPaths: string[] = [];
  let uploadError: any = null;

  let currentIndex = 0;
  async function uploadWorker() {
    while (currentIndex < uniqueNewItems.length && !uploadError) {
      const taskIndex = currentIndex++;
      const item = uniqueNewItems[taskIndex];

      try {
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(item.storagePath, item.blob, {
            contentType: item.mimeType,
            cacheControl: '31536000',
            upsert: false,
          });

        if (upErr && !upErr.message?.includes('already exists') && !upErr.message?.includes('Duplicate')) {
          throw new Error(upErr.message || 'Image storage upload failed.');
        }

        uploadedPaths.push(item.storagePath);
      } catch (err: any) {
        uploadError = err;
        break;
      }
    }
  }

  if (uniqueNewItems.length > 0) {
    const workerCount = Math.min(UPLOAD_CONCURRENCY, uniqueNewItems.length);
    const workers = Array.from({ length: workerCount }, () => uploadWorker());
    await Promise.allSettled(workers);

    if (uploadError) {
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
        } catch (cleanupErr) {
          console.error('Failed to clean up storage after upload error:', cleanupErr);
        }
      }
      throw new Error(`Image upload failed: ${uploadError?.message || 'Storage error'}`);
    }
  }

  // Build RPC Payload
  const customSpecsPayload = (customSpecs || [])
    .map((s) => ({
      ...(s.id && s.id.length === 36 ? { id: s.id } : {}),
      name: s.name.trim(),
      value: s.value.trim(),
    }))
    .filter((s) => s.name.length > 0 && s.value.length > 0);

  const attributeValuesPayload: Array<{ attributeId: string; value: any }> = [];
  if (specValues) {
    for (const [attrId, val] of Object.entries(specValues)) {
      if (val !== undefined && val !== null && val !== '') {
        attributeValuesPayload.push({ attributeId: attrId, value: val });
      }
    }
  }

  let optionsPayload: any[] = [];
  let variantsPayload: any[] = [];

  if (isVariantMode) {
    optionsPayload = enabledDimensions.map((dim, dimIdx) => {
      const optionDbId = dim.dbId || (dim.id?.length === 36 ? dim.id : undefined);
      return {
        ...(optionDbId ? { id: optionDbId } : {}),
        ref: dim.ref || `opt_${dimIdx}`,
        name: dim.name.trim(),
        values: dim.values.map((v, valIdx) => {
          const trimmedVal = v.trim();
          const valDbId = dim.valueIds?.[v] || dim.valueIds?.[trimmedVal];
          const normKey = `${dim.name.trim().toLowerCase()}::${trimmedVal.toLowerCase()}`;
          const img = optionValueImageMap.get(normKey);
          const imageProp = optionImagesLoaded
            ? { image: img || null }
            : (img ? { image: img } : {});
          return {
            ...(valDbId ? { id: valDbId } : {}),
            ref: `val_${dimIdx}_${valIdx}`,
            value: trimmedVal,
            ...imageProp,
          };
        }),
      };
    });

    const rows = variationConfig?.rows || [];
    variantsPayload = rows.map((r, rIdx) => {
      const rowValues = enabledDimensions.map((dim) => {
        const dimVal =
          r.attributes?.[dim.name] ||
          (dim.name.toLowerCase() === 'color' ? r.color : null) ||
          (dim.name.toLowerCase() === 'size' ? r.size : null) ||
          '';
        return String(dimVal).trim();
      });

      return {
        ...(r.dbId ? { id: r.dbId } : {}),
        ref: `var_${rIdx}`,
        values: rowValues,
        valueRefs: rowValues,
        sellingPrice: Number(r.price),
        quantity: typeof r.quantity === 'object' ? r.quantity : Number(r.quantity),
        isActive: r.isActive !== undefined ? r.isActive : true,
      };
    });
  }

  const payload: any = {
    targetMode: isVariantMode ? 'variants' : 'simple',
    confirm: {
      conversion: Boolean(confirmDestructive),
      destructive: Boolean(confirmDestructive),
    },
    categoryId,
    title: cleanTitle,
    description: description ? description.trim() : null,
    defect: defect ? defect.trim() : null,
    simple: isVariantMode
      ? null
      : {
          sellingPrice: Number(simple!.sellingPrice),
          compareAtPrice:
            simple!.compareAtPrice !== null && simple!.compareAtPrice !== undefined
              ? Number(simple!.compareAtPrice)
              : null,
          quantity: typeof simple!.quantity === 'object' ? simple!.quantity : Number(simple!.quantity),
        },
    images: galleryImageRefs,
    customSpecs: customSpecsPayload,
    attributeValues: attributeValuesPayload,
    options: optionsPayload,
    variants: variantsPayload,
  };

  if (input.patch?.product) {
    payload.product = input.patch.product;
  }

  // Removals detected via the change patch (e.g. a specification cleared or removed
  // by the seller during this edit session). Sent to the RPC so it can exempt
  // intentionally-removed values from the required-attribute validation.
  const attributeRemovals: string[] = input.patch?.attributeValues?.removeAttributeIds || [];
  const customSpecRemovals: string[] = input.patch?.customSpecs?.removeIds || [];

  if (attributeRemovals.length > 0) {
    payload.attributeRemovals = {
      attributeIds: attributeRemovals,
    };
  }

  if (customSpecRemovals.length > 0) {
    payload.customSpecRemovals = {
      ids: customSpecRemovals,
    };
  }

  // Call Atomic Database RPC
  let rpcData: any = null;
  let rpcError: any = null;

  try {
    const { data, error } = await supabase.rpc('update_product_with_changes', {
      p_product_id: productId,
      p_expected_updated_at: expectedUpdatedAt || null,
      p_payload: payload,
    });

    if (error) {
      rpcError = error;
    } else {
      rpcData = data;
    }
  } catch (err: any) {
    rpcError = err;
  }

  if (rpcError) {
    // Rollback newly uploaded paths of this attempt
    if (uploadedPaths.length > 0) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
      } catch (cleanupErr) {
        console.error('Storage rollback error:', cleanupErr);
      }
    }

    const rawMsg = rpcError?.message || String(rpcError);
    if (rawMsg.includes('CONFLICT:')) {
      throw new Error(
        'This listing was modified in another tab or window. Your form edits have been kept on screen, but please reload the latest version before saving.'
      );
    }
    if (rawMsg.includes('VALIDATION:')) {
      throw new Error(rawMsg.replace(/^.*VALIDATION:\s*/, ''));
    }
    if (
      rpcError?.code === 'PGRST202' ||
      rawMsg.includes('schema cache') ||
      rawMsg.includes('Could not find the function') ||
      rawMsg.includes('update_product_with_changes')
    ) {
      throw new Error(
        'Database function public.update_product_with_changes not found in schema cache. Please ensure the migration script (supabase/migrations/20261106_update_product_with_changes_rpc.sql) has been executed in your Supabase SQL editor.'
      );
    }

    throw new Error(formatDatabaseError(rpcError));
  }

  // Post-Commit Storage Cleanup: remove orphaned paths identified by database
  const orphanedPaths: string[] = rpcData?.orphaned_paths || rpcData?.orphanedPaths || [];
  if (Array.isArray(orphanedPaths) && orphanedPaths.length > 0) {
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove(orphanedPaths);
    } catch (orphanErr) {
      console.warn('Storage cleanup notice (orphaned objects removal non-fatal):', orphanErr);
    }
  }

  return {
    success: true,
    data: rpcData,
  };
}

export type DeleteArchiveReason = 'orders' | 'reviews' | 'permissions';

export interface DeleteProductResult {
  outcome: 'deleted' | 'archived';
  orphanedPaths: string[];
  /** Present when outcome is 'archived'; explains why a hard delete was not performed. */
  reason?: DeleteArchiveReason;
}

/**
 * Detects the PostgREST error returned when an RPC does not exist in the
 * database (or the PostgREST schema cache has not picked it up yet).
 */
function isMissingRpcFunctionError(err: any): boolean {
  if (!err) return false;
  const message = String(err.message || err.error_description || err).toLowerCase();
  return (
    err.code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('schema cache')
  );
}

/**
 * Detects errors caused by an optional child table not existing in a
 * particular deployment. These are safe to skip during fallback deletion.
 */
function isMissingTableError(err: any): boolean {
  if (!err) return false;
  const message = String(err.message || '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    message.includes('could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

function formatDeleteProductError(err: any): string {
  if (!err) return 'Database error occurred while deleting product.';
  const message = String(err.message || err.error_description || err).trim();
  if (message.startsWith('VALIDATION:')) {
    return message.replace(/^VALIDATION:\s*/, '');
  }
  if (err.code === '42501' || message.toLowerCase().includes('row-level security')) {
    return 'Permission denied: you can only delete listings that belong to your seller account.';
  }
  return message || 'Database error occurred while deleting product.';
}

/**
 * Calls the delete_product RPC. Some deployments created the function with a
 * plain `product_id` argument instead of `p_product_id`, so retry that signature
 * before giving up.
 */
async function callDeleteProductRpc(productId: string): Promise<{ data: any; error: any }> {
  const primary = await supabase.rpc('delete_product', { p_product_id: productId });
  if (!primary.error || !isMissingRpcFunctionError(primary.error)) {
    return primary;
  }

  const legacy = await supabase.rpc('delete_product', { product_id: productId });
  if (legacy.error && isMissingRpcFunctionError(legacy.error)) {
    // Neither signature exists; return the original error so the caller can
    // switch to the client-side fallback.
    return primary;
  }
  return legacy;
}

/**
 * Archives a product instead of hard-deleting it. Used when order/review data
 * or missing DELETE policies make a permanent delete unsafe.
 */
async function archiveProduct(
  productId: string,
  sellerId: string,
  reason: DeleteArchiveReason
): Promise<DeleteProductResult> {
  const { data, error } = await supabase
    .from('products')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .select('id, status')
    .maybeSingle();

  if (error) {
    throw new Error(formatDeleteProductError(error));
  }
  if (!data) {
    throw new Error(
      'Could not archive this product. Please check your permissions and try again.'
    );
  }

  return { outcome: 'archived', orphanedPaths: [], reason };
}

/**
 * Fallback used when the delete_product RPC is not installed in the database.
 *
 * Safety rules:
 * - Products with order history are archived, never hard-deleted.
 * - Products with reviews are archived (sellers have no reviews DELETE policy).
 * - Inventory movements are removed first and verified, because their FK is
 *   ON DELETE RESTRICT and they need an explicit DELETE policy.
 * - If any step cannot be completed, the product is archived instead of leaving
 *   a partially deleted listing.
 */
async function deleteProductWithoutRpc(productId: string): Promise<DeleteProductResult> {
  // 1. Resolve the signed-in seller and load their product. Filtering by
  //    seller_id here mirrors the RPC's auth.uid() ownership check.
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const currentUserId = authData?.user?.id;

  if (authError || !currentUserId) {
    throw new Error('Authentication required: you must be signed in as a seller to delete a listing.');
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, seller_id')
    .eq('id', productId)
    .eq('seller_id', currentUserId)
    .maybeSingle();

  if (productError) {
    throw new Error(formatDeleteProductError(productError));
  }
  if (!product?.seller_id) {
    throw new Error('Product not found or you do not have permission to delete it.');
  }

  const sellerId = String(product.seller_id);

  // 2. Never destroy order history.
  const { data: orderRows, error: orderError } = await supabase
    .from('order_items')
    .select('id')
    .eq('product_id', productId)
    .limit(1);

  if (orderError) {
    if (!isMissingTableError(orderError)) {
      // If order history cannot be verified, archive conservatively.
      console.warn('[deleteProduct] Could not verify order history; archiving instead.', orderError);
      return archiveProduct(productId, sellerId, 'permissions');
    }
  } else if (Array.isArray(orderRows) && orderRows.length > 0) {
    return archiveProduct(productId, sellerId, 'orders');
  }

  // 3. Sellers cannot delete reviews through RLS; archive when any exist.
  const { count: reviewCount, error: reviewError } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  if (reviewError) {
    if (!isMissingTableError(reviewError)) {
      console.warn('[deleteProduct] Could not verify reviews; archiving instead.', reviewError);
      return archiveProduct(productId, sellerId, 'permissions');
    }
  } else if ((reviewCount ?? 0) > 0) {
    return archiveProduct(productId, sellerId, 'reviews');
  }

  // 4. Collect storage objects owned by this product for post-delete cleanup.
  const orphanedPaths = new Set<string>();
  const addStoragePaths = (rows: any) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      const path = typeof row?.storage_path === 'string' ? row.storage_path.trim() : '';
      if (path && path.startsWith(`${sellerId}/${productId}/`)) {
        orphanedPaths.add(path);
      }
    }
  };

  const { data: imageRows } = await supabase
    .from('product_images')
    .select('storage_path')
    .eq('product_id', productId);
  addStoragePaths(imageRows);

  const { data: optionImageRows } = await supabase
    .from('product_option_images')
    .select('storage_path')
    .eq('product_id', productId);
  addStoragePaths(optionImageRows);

  // 5. Inventory movements are protected by ON DELETE RESTRICT and require a
  //    dedicated DELETE policy. Remove them first and verify the count so a
  //    missing policy aborts before any other row is touched.
  const { count: inventoryCount } = await supabase
    .from('inventory_movements')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  if ((inventoryCount ?? 0) > 0) {
    const { data: removedMovements, error: movementError } = await supabase
      .from('inventory_movements')
      .delete()
      .eq('product_id', productId)
      .select('id');

    if (movementError || (removedMovements?.length ?? 0) !== inventoryCount) {
      console.warn(
        '[deleteProduct] inventory_movements could not be fully removed (missing DELETE policy?). Archiving instead.',
        movementError
      );
      return archiveProduct(productId, sellerId, 'permissions');
    }
  }

  // 6. Delete remaining child rows in FK-safe order. Variants are removed
  //    before variant_option_values so any cascade/trigger ordering stays safe.
  const childTables = [
    'product_option_images',
    'product_variants',
    'variant_option_values',
    'product_option_values',
    'product_options',
    'product_attribute_values',
    'product_custom_attributes',
    'product_images',
    'cart_items',
    'wishlist_items',
  ];

  for (const table of childTables) {
    const { error: childError } = await supabase
      .from(table)
      .delete()
      .eq('product_id', productId);

    if (childError && !isMissingTableError(childError)) {
      console.warn(`[deleteProduct] Failed to delete ${table} rows; archiving instead.`, childError);
      return archiveProduct(productId, sellerId, 'permissions');
    }
  }

  // 7. Delete the parent product row last.
  const { data: deletedRow, error: deleteError } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .select('id')
    .maybeSingle();

  if (deleteError) {
    console.warn('[deleteProduct] Parent product delete failed; archiving instead.', deleteError);
    return archiveProduct(productId, sellerId, 'permissions');
  }
  if (!deletedRow) {
    throw new Error('Product could not be deleted. Please check your permissions and try again.');
  }

  return { outcome: 'deleted', orphanedPaths: Array.from(orphanedPaths) };
}

/**
 * Best-effort removal of product storage objects after the database delete has
 * committed. Retries once. Storage is never touched before the DB commit.
 */
async function cleanupOrphanedProductStorage(orphanedPaths: string[]): Promise<void> {
  if (!Array.isArray(orphanedPaths) || orphanedPaths.length === 0) return;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { error: storageErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(orphanedPaths);

      if (!storageErr) {
        return;
      }

      if (attempt === 1) {
        console.warn(`[deleteProduct] Storage removal attempt 1 warning: ${storageErr.message}, retrying...`);
      } else {
        console.warn(`[deleteProduct] Storage removal attempt 2 failed: ${storageErr.message}`);
      }
    } catch (err: any) {
      if (attempt === 1) {
        console.warn(`[deleteProduct] Storage removal attempt 1 exception: ${err?.message || err}, retrying...`);
      } else {
        console.warn(`[deleteProduct] Storage removal attempt 2 exception:`, err);
      }
    }
  }
}

/**
 * Executes atomic product deletion via single-transaction Postgres RPC:
 * 1. Calls delete_product RPC which enforces seller ownership via auth.uid().
 * 2. If order_items exist, product is automatically transitioned to 'archived' instead of hard delete.
 * 3. If no orders exist, child rows and parent product are hard-deleted in safe FK order,
 *    and orphaned storage paths under {sellerId}/{productId}/ are returned.
 * 4. Post-commit storage cleanup: removes orphaned paths with 1 retry (storage is NEVER touched before commit).
 *
 * If the RPC has not been installed yet, a safe client-side fallback is used so
 * the delete button still works. Run supabase/migrations/20261107_fix_product_deletion_rpc.sql
 * to enable the fully atomic RPC path.
 */
export async function deleteProduct(productId: string): Promise<DeleteProductResult> {
  if (!productId || typeof productId !== 'string' || !productId.trim()) {
    throw new Error('A valid product ID is required to delete a product.');
  }

  const trimmedId = productId.trim();

  // 1. Execute atomic single-transaction RPC
  const { data, error } = await callDeleteProductRpc(trimmedId);

  if (error) {
    if (isMissingRpcFunctionError(error)) {
      console.warn(
        '[deleteProduct] The delete_product RPC is missing from the database. ' +
          'Using the client-side fallback. Run supabase/migrations/20261107_fix_product_deletion_rpc.sql ' +
          'in the Supabase SQL editor to enable atomic deletion.'
      );
      const fallbackResult = await deleteProductWithoutRpc(trimmedId);
      if (fallbackResult.outcome === 'deleted') {
        await cleanupOrphanedProductStorage(fallbackResult.orphanedPaths);
      }
      return fallbackResult;
    }
    throw new Error(formatDeleteProductError(error));
  }

  const outcome = (data?.outcome || 'deleted') as 'deleted' | 'archived';
  const orphanedPaths: string[] = Array.isArray(data?.orphanedPaths) ? data.orphanedPaths : [];

  // 2. Storage cleanup: ONLY after successful DB commit, best-effort with 1 retry
  if (outcome === 'deleted') {
    await cleanupOrphanedProductStorage(orphanedPaths);
  }

  return {
    outcome,
    orphanedPaths,
    reason: outcome === 'archived' ? 'orders' : undefined,
  };
}

/**
 * Updates a product's active / inactive status in the products table:
 * Uses .select('id, status, updated_at').maybeSingle() so zero matching rows (or RLS block)
 * is detected and handled as a failure rather than a silent success.
 */
export async function setProductStatus(
  productId: string,
  sellerId: string,
  newStatus: 'active' | 'inactive'
): Promise<{ id: string; status: string; updated_at: string }> {
  if (!productId || typeof productId !== 'string' || !productId.trim()) {
    throw new Error('A valid product ID is required to update status.');
  }
  if (!sellerId || typeof sellerId !== 'string' || !sellerId.trim()) {
    throw new Error('Authentication Error: Seller ID is required.');
  }

  const trimmedId = productId.trim();
  const trimmedSellerId = sellerId.trim();

  const { data, error } = await supabase
    .from('products')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', trimmedId)
    .eq('seller_id', trimmedSellerId)
    .select('id, status, updated_at')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Product not found or you do not have permission to update its status.');
  }

  return data;
}

/**
 * Maps PostgreSQL trigger and constraint errors (such as check_active_product_inventory)
 * to friendly, actionable messages for the seller. Never displays raw SQL to the user.
 */
export function mapStatusUpdateError(error: any): string {
  const msg = (error?.message || '').toLowerCase();

  if (
    msg.includes('quantity of 0') ||
    msg.includes('stock') ||
    msg.includes('cannot have a quantity of 0') ||
    msg.includes('total quantity of 0') ||
    msg.includes('check_active_product_inventory')
  ) {
    return 'Add stock before activating this product.';
  }

  if (msg.includes('selling_price') || (msg.includes('price') && msg.includes('null'))) {
    return 'An active product requires a valid selling price.';
  }

  if (msg.includes('option dimension') || msg.includes('selections; expected') || msg.includes('variant')) {
    return 'Please configure product variations and stock before activating.';
  }

  if (msg.includes('products_status_check') || msg.includes('invalid status')) {
    return 'Invalid product status transition.';
  }

  if (msg.includes('permission denied') || msg.includes('policy') || error?.code === '42501') {
    return 'You do not have permission to update this product status.';
  }

  return 'Unable to update listing status. Please ensure product details, pricing, and stock are valid.';
}

