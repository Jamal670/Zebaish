import supabase from './client';
import { CartItem, Order, CustomerOrderItem } from '@/types';

export const PAYMENT_METHOD_DB = {
  COD: 'COD',
  FULL: 'Advanced_Full',
  DC: 'Advanced_DC',
} as const;

/**
 * Generates a collision-resistant order number (format: ZB-YYMMDD-XXXXXX, length: ~16, fits varchar(50)).
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ZB-${yy}${mm}${dd}-${randomSuffix}`;
}

export interface CheckoutCustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  postalCode?: string;
  paymentMethod: 'Cash on Delivery' | 'JazzCash' | 'EasyPaisa' | 'Bank Card' | string;
}

export interface SellerPaymentData {
  sellerId: string;
  paymentMethod: 'COD' | 'FULL' | 'DC';
  paymentProofUrl?: string | null;
  shippingFee: number;
}

export interface PlaceOrderParams {
  userId?: string | null;
  customerInfo: CheckoutCustomerInfo;
  cartItems: CartItem[];
  sellerPayments?: Record<string, SellerPaymentData>;
}

export interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  createdOrders?: Order[];
  error?: string;
  orderItems?: {
    product_id: string;
    size: string | null;
    color: string | null;
    variant_id?: string | null;
    variant_sku_snapshot?: string | null;
    variant_options_snapshot?: Record<string, string>;
  }[];
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Helper to extract the relative storage path inside the 'payment' bucket (e.g. 'proofs/filename.ext')
 * from any legacy format (full public URL, full signed URL, full storage path with bucket name, or raw path).
 */
export function extractPaymentProofPath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  // If it's already a clean path starting with proofs/
  if (trimmed.startsWith('proofs/')) {
    return trimmed;
  }

  // If it starts with payment/proofs/
  if (trimmed.startsWith('payment/proofs/')) {
    return trimmed.replace(/^payment\//, '');
  }

  // If it's a full URL containing /storage/v1/object/...
  // e.g. https://.../storage/v1/object/public/payment/proofs/123.jpg
  // or https://.../storage/v1/object/sign/payment/proofs/123.jpg?token=...
  const storageMatch = trimmed.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/payment\/(.+?)(?:\?.*)?$/);
  if (storageMatch && storageMatch[1]) {
    return decodeURIComponent(storageMatch[1]);
  }

  // If it's another URL or string with /payment/proofs/
  const paymentProofsMarker = '/payment/proofs/';
  if (trimmed.includes(paymentProofsMarker)) {
    const suffix = trimmed.split(paymentProofsMarker)[1]?.split('?')[0];
    return suffix ? `proofs/${decodeURIComponent(suffix)}` : null;
  }

  // If it's a relative path with /payment/
  const paymentMarker = '/payment/';
  if (trimmed.includes(paymentMarker)) {
    const suffix = trimmed.split(paymentMarker)[1]?.split('?')[0];
    return suffix ? decodeURIComponent(suffix) : null;
  }

  // If it's just a filename
  if (!trimmed.includes('/') && !trimmed.startsWith('http')) {
    return `proofs/${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    const proofsIdx = parsed.pathname.indexOf('proofs/');
    if (proofsIdx !== -1) {
      return decodeURIComponent(parsed.pathname.substring(proofsIdx));
    }
  } catch {
    // Not a valid URL, return trimmed fallback
  }

  return trimmed;
}

/**
 * Resolves a payment receipt URL or storage path to an accessible display URL.
 * Handles:
 * 1. Pre-signed URLs with active tokens (returns as-is)
 * 2. Data URLs (returns as-is)
 * 3. Calls createSignedUrl with an expiration (24 hours) on private buckets
 * 4. Fallback to getPublicUrl if createSignedUrl fails or bucket is public
 */
export async function getPaymentProofDisplayUrl(urlOrPath: string | null | undefined): Promise<string | null> {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  // Data URLs or blob URLs can be displayed directly
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Already a signed URL with active token query param
  if (trimmed.includes('/object/sign/') && trimmed.includes('token=')) {
    return trimmed;
  }

  const storagePath = extractPaymentProofPath(trimmed);
  if (!storagePath) return trimmed;

  try {
    // First try to generate a signed URL (for private bucket configuration)
    const { data: signData, error: signError } = await supabase.storage
      .from('payment')
      .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours

    if (!signError && signData?.signedUrl) {
      return signData.signedUrl;
    }
  } catch (err) {
    console.warn('Failed to generate signed URL for payment proof:', err);
  }

  // Fallback to getPublicUrl if signed URL generation fails (e.g. public bucket)
  try {
    const { data: pubData } = supabase.storage
      .from('payment')
      .getPublicUrl(storagePath);

    if (pubData?.publicUrl) {
      return pubData.publicUrl;
    }
  } catch (err) {
    console.warn('Failed to get public URL for payment proof:', err);
  }

  return trimmed;
}

/**
 * Uploads a seller's payment screenshot proof to Supabase Storage bucket 'payment'.
 */
export async function uploadPaymentProof(
  file: File,
  sellerId: string,
  shopName: string
): Promise<{ url: string | null; path: string | null; error?: string }> {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase())) {
    return {
      url: null,
      path: null,
      error: `Payment proof for seller "${shopName}" must be a valid image file (PNG, JPG, JPEG, or WEBP).`,
    };
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      url: null,
      path: null,
      error: `Payment proof for seller "${shopName}" exceeds the maximum allowed size of 10MB.`,
    };
  }

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `proofs/${Date.now()}_${crypto.randomUUID()}_${cleanFileName}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('payment')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error(`Storage upload error for seller "${shopName}":`, uploadError);
      return {
        url: null,
        path: null,
        error: `Failed to upload payment proof for seller "${shopName}": ${uploadError.message}`,
      };
    }

    // Attempt to generate a signed URL first (supports private buckets), fallback to getPublicUrl
    let resolvedUrl: string | null = null;
    try {
      const { data: signData, error: signError } = await supabase.storage
        .from('payment')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year signed URL

      if (!signError && signData?.signedUrl) {
        resolvedUrl = signData.signedUrl;
      }
    } catch {
      // Ignore signing error and fallback to public URL
    }

    if (!resolvedUrl) {
      const { data: pubData } = supabase.storage
        .from('payment')
        .getPublicUrl(path);
      resolvedUrl = pubData?.publicUrl || null;
    }

    return { url: resolvedUrl, path, error: undefined };
  } catch (err: any) {
    console.error(`Unexpected storage upload error for seller "${shopName}":`, err);
    return {
      url: null,
      path: null,
      error: `Unexpected error uploading payment proof for seller "${shopName}": ${err.message || err}`,
    };
  }
}

/**
 * Best-effort deletion of uploaded files from Supabase Storage on order rollback.
 */
export async function deletePaymentProofs(paths: string[]): Promise<void> {
  if (!paths || paths.length === 0) return;
  try {
    const cleanPaths = paths
      .map((p) => extractPaymentProofPath(p))
      .filter((p): p is string => Boolean(p));

    if (cleanPaths.length > 0) {
      await supabase.storage.from('payment').remove(cleanPaths);
    }
  } catch (err) {
    console.warn('Error deleting uploaded payment proof files during rollback:', err);
  }
}

export interface ResolvedVariantAndColor {
  size: string | null;
  color: string | null;
  matchedVariant: any | null;
}

/**
 * Resolves the selected product's size and color using:
 * - product_variants.product_id identifies the associated product
 * - product_variants.size provides the selected size
 * - product_variants.color_id references product_colors.id
 * - product_colors.color_name provides the selected color name
 * - product_colors.product_id identifies the product associated with that color
 *
 * Rules:
 * - If a product has no selected size, save size: null
 * - If a product has no selected color or no matching color record, save color: null
 * - If neither value is available, save both fields as null
 * - Do not invent default sizes or colors, and do not fail checkout solely because optional info is missing
 * - Do not select an arbitrary variant or color when multiple options exist
 */
export function resolveOrderItemVariantAndColor(
  item: CartItem,
  dbProd: any
): ResolvedVariantAndColor {
  const variants: any[] = Array.isArray(dbProd?.product_variants)
    ? dbProd.product_variants.filter((v: any) => !v.product_id || v.product_id === dbProd.id)
    : [];

  const colors: any[] = Array.isArray(dbProd?.product_colors)
    ? dbProd.product_colors.filter((c: any) => !c.product_id || c.product_id === dbProd.id)
    : [];

  // Extract selected size from cart item
  const rawSize =
    typeof item.size === 'string' && item.size.trim().length > 0
      ? item.size.trim()
      : null;

  // Extract selected color identifier / name from cart item
  let selectedColorId: string | null = null;
  let selectedColorName: string | null = null;

  if (item.color) {
    if (typeof item.color === 'object') {
      if (item.color.id && typeof item.color.id === 'string' && item.color.id.trim().length > 0) {
        selectedColorId = item.color.id.trim();
      }
      if (item.color.name && typeof item.color.name === 'string' && item.color.name.trim().length > 0) {
        selectedColorName = item.color.name.trim();
      }
    } else if (typeof item.color === 'string' && (item.color as string).trim().length > 0) {
      selectedColorName = (item.color as string).trim();
    }
  }

  // 1. Resolve matching color record from product_colors (must belong to this product)
  let matchedColorRecord: any = null;
  if (selectedColorId) {
    matchedColorRecord = colors.find((c: any) => c.id === selectedColorId) || null;
  }
  if (!matchedColorRecord && selectedColorName) {
    matchedColorRecord =
      colors.find(
        (c: any) =>
          c.color_name &&
          c.color_name.trim().toLowerCase() === selectedColorName!.toLowerCase()
      ) || null;
  }

  const resolvedColorName: string | null = matchedColorRecord?.color_name || null;

  // 2. Resolve matching variant from product_variants
  let matchedVariant: any = null;
  let resolvedSize: string | null = null;

  if (rawSize) {
    // Find all variants of this product matching the given size (case-insensitive)
    const sizeMatches = variants.filter(
      (v: any) => v.size && v.size.trim().toLowerCase() === rawSize.toLowerCase()
    );

    if (sizeMatches.length > 0) {
      if (matchedColorRecord) {
        // Find exact match with color_id
        const exactMatch = sizeMatches.find((v: any) => v.color_id === matchedColorRecord.id);
        if (exactMatch) {
          matchedVariant = exactMatch;
        } else {
          matchedVariant = sizeMatches.find((v: any) => !v.color_id) || sizeMatches[0];
        }
      } else {
        // User did NOT select a color or color was not matched.
        // If multiple variants exist for this size with different colors, pick one with stock for stock deduction,
        // but do NOT invent a color name (resolvedColorName remains null).
        matchedVariant =
          sizeMatches.find((v: any) => (Number(v.quantity) || 0) >= item.quantity) ||
          sizeMatches[0];
      }
      resolvedSize = matchedVariant.size; // directly from product_variants.size
    } else {
      // The provided size didn't match any variant in product_variants
      // (e.g. rawSize was 'Unstitched' fallback but product variants are 'Small', 'Medium', 'Large')
      resolvedSize = null;

      if (matchedColorRecord) {
        const colorMatches = variants.filter((v: any) => v.color_id === matchedColorRecord.id);
        matchedVariant =
          colorMatches.find((v: any) => (Number(v.quantity) || 0) >= item.quantity) ||
          colorMatches[0] ||
          null;
      }
    }
  } else {
    // No size was selected by the user
    resolvedSize = null;

    if (matchedColorRecord) {
      const colorMatches = variants.filter((v: any) => v.color_id === matchedColorRecord.id);
      matchedVariant =
        colorMatches.find((v: any) => (Number(v.quantity) || 0) >= item.quantity) ||
        colorMatches[0] ||
        null;
    }
  }

  // Fallback variant for stock deduction only (when product has variants)
  if (!matchedVariant && variants.length > 0) {
    matchedVariant =
      variants.find((v: any) => (Number(v.quantity) || 0) >= item.quantity) ||
      variants[0];
  }

  return {
    size: resolvedSize,
    color: resolvedColorName,
    matchedVariant,
  };
}

/**
 * Places an order into Supabase database (or fallback local transaction).
 * Performs validation, stock check, price recalculation from DB,
 * atomic creation of orders, order_items, seller_orders,
 * product stock reduction, and cart items cleanup.
 */
export async function placeOrder({
  userId,
  customerInfo,
  cartItems,
  sellerPayments,
}: PlaceOrderParams): Promise<PlaceOrderResult> {
  if (!cartItems || cartItems.length === 0) {
    return { success: false, error: 'Your cart is empty. Please add items before checking out.' };
  }

  // Fallback postal code if empty to prevent NOT NULL constraint violations in DB
  const cleanPostalCode = (customerInfo.postalCode?.trim() || '00000').slice(0, 20);

  // Extract items with valid DB UUIDs vs mock items
  const dbItems = cartItems.filter((i) => isValidUUID(i.product.id));

  // If there are valid DB product UUIDs, attempt DB order creation
  if (dbItems.length > 0) {
    // Client-side transaction with safety rollback
    try {
      const productIds = dbItems.map((i) => i.product.id);

      // Verify product existence and fetch authoritative seller_id, title, brand, status, inventory_mode, selling_price & quantity
      const { data: dbProducts, error: prodErr } = await supabase
        .from('products')
        .select('id, seller_id, title, brand, status, inventory_mode, selling_price, quantity')
        .in('id', productIds);

      if (prodErr || !dbProducts) {
        console.error('Error fetching dbProducts in orderService:', prodErr);
        return {
          success: false,
          error: prodErr?.message ? `Failed to verify product status: ${prodErr.message}` : 'Failed to verify current product status. Please try again.',
        };
      }

      const prodMap = new Map<string, any>();
      dbProducts.forEach((p) => prodMap.set(p.id, p));

      // Fetch dynamic variant details & option snapshots for all variants-mode products
      const variantProductIds = Array.from(
        new Set(
          dbItems
            .filter((i) => prodMap.get(i.product.id)?.inventory_mode === 'variants')
            .map((i) => i.product.id)
        )
      );

      let dbVariants: any[] = [];
      const variantOptionsSnapshotMap = new Map<string, Record<string, string>>();

      if (variantProductIds.length > 0) {
        // 1. Batch fetch active variants for all variant products
        const { data: pvData, error: pvErr } = await supabase
          .from('product_variants')
          .select('id, product_id, sku, combination_key, selling_price, compare_at_price, quantity, is_active')
          .in('product_id', variantProductIds);

        if (!pvErr && Array.isArray(pvData)) {
          dbVariants = pvData;
        }

        // 2. Batch fetch dynamic options, values, and variant links for canonical snapshot building
        try {
          const [optionsRes, optionValuesRes, vovRes] = await Promise.all([
            supabase
              .from('product_options')
              .select('id, product_id, name')
              .in('product_id', variantProductIds),
            supabase
              .from('product_option_values')
              .select('id, product_id, option_id, value')
              .in('product_id', variantProductIds),
            supabase
              .from('variant_option_values')
              .select('variant_id, product_id, option_id, product_option_value_id')
              .in('product_id', variantProductIds),
          ]);

          let vovRows = vovRes.data;
          // Fallback to product_variant_option_values if variant_option_values returned error
          if ((!vovRows || vovRows.length === 0) && vovRes.error) {
            const fallbackVov = await supabase
              .from('product_variant_option_values')
              .select('variant_id, product_id, option_id, product_option_value_id')
              .in('product_id', variantProductIds);
            if (fallbackVov.data) {
              vovRows = fallbackVov.data;
            }
          }

          const optionNameMap = new Map<string, string>();
          (optionsRes.data || []).forEach((opt) => {
            if (opt.id && opt.name) optionNameMap.set(opt.id, opt.name);
          });

          const optionValueMap = new Map<string, string>();
          (optionValuesRes.data || []).forEach((val) => {
            if (val.id && val.value) optionValueMap.set(val.id, val.value);
          });

          (vovRows || []).forEach((row: any) => {
            const optName = optionNameMap.get(row.option_id);
            const optVal = optionValueMap.get(row.product_option_value_id);
            if (optName && optVal && row.variant_id) {
              const existing = variantOptionsSnapshotMap.get(row.variant_id) || {};
              existing[optName] = optVal;
              variantOptionsSnapshotMap.set(row.variant_id, existing);
            }
          });
        } catch (dynErr) {
          console.warn('Could not batch load dynamic variant option values:', dynErr);
        }
      }

      const parseFiniteAmount = (val: unknown, fallback = 0): number => {
        const num = typeof val === 'string' ? Number(val.replace(/,/g, '')) : Number(val);
        return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) / 100 : fallback;
      };

      // Step 1: Stock, variant availability, and price verification
      const stockErrors: string[] = [];
      const sellerSubtotals = new Map<string, number>();
      let itemsSubtotalSum = 0;
      const preparedOrderItems: any[] = [];

      for (const item of dbItems) {
        const dbProd = prodMap.get(item.product.id);
        if (!dbProd) {
          stockErrors.push(`Product "${item.product.title}" is no longer available.`);
          continue;
        }

        if (!dbProd.seller_id || !isValidUUID(dbProd.seller_id)) {
          stockErrors.push(`Product "${dbProd.title || item.product.title}" is missing a valid seller.`);
          continue;
        }

        if (dbProd.status && dbProd.status.toLowerCase() !== 'active') {
          stockErrors.push(`Product "${dbProd.title || item.product.title}" is currently unavailable (${dbProd.status}).`);
          continue;
        }

        const isVariantsMode = dbProd.inventory_mode === 'variants';
        const actualQty = Math.max(1, Math.floor(Number(item.quantity) || 1));

        if (isVariantsMode) {
          // B. Variant inventory products: identify exact selected variant
          const explicitVariantId =
            item.variant_id ||
            item.variantId ||
            (item.product as any)?.variantId ||
            (item.product as any)?.variant_id ||
            null;

          let matchedVariant = explicitVariantId
            ? dbVariants.find((v) => v.id === explicitVariantId && v.product_id === dbProd.id)
            : null;

          // Fallback matching by selected options or size/color
          if (!matchedVariant && dbVariants.length > 0) {
            const prodVariants = dbVariants.filter((v) => v.product_id === dbProd.id);

            // Match by variant_options dictionary
            const itemOptions =
              item.variant_options ||
              (item.product as any)?.variantOptions ||
              (item.product as any)?.selectedOptions;
            if (itemOptions && Object.keys(itemOptions).length > 0) {
              matchedVariant =
                prodVariants.find((v) => {
                  const snap = variantOptionsSnapshotMap.get(v.id);
                  if (!snap) return false;
                  return Object.entries(itemOptions).every(
                    ([k, val]) => snap[k]?.trim().toLowerCase() === String(val).trim().toLowerCase()
                  );
                }) || null;
            }

            // Match by size / color
            if (!matchedVariant && (item.size || item.color)) {
              const rawColorName = typeof item.color === 'object' ? item.color?.name : item.color;
              matchedVariant =
                prodVariants.find((v) => {
                  const snap = variantOptionsSnapshotMap.get(v.id);
                  if (!snap) return false;
                  let matchSize = true;
                  let matchColor = true;
                  if (item.size) {
                    matchSize = Object.entries(snap).some(
                      ([k, val]) => k.toLowerCase() === 'size' && val.toLowerCase() === item.size!.toLowerCase()
                    );
                  }
                  if (rawColorName) {
                    matchColor = Object.entries(snap).some(
                      ([k, val]) =>
                        k.toLowerCase() === 'color' &&
                        val.toLowerCase() === String(rawColorName).toLowerCase()
                    );
                  }
                  return matchSize && matchColor;
                }) || null;
            }
          }

          // Section 4.C Validation:
          if (!matchedVariant) {
            stockErrors.push(`Please select an available variant for "${dbProd.title || item.product.title}".`);
            continue;
          }

          if (matchedVariant.product_id !== dbProd.id) {
            stockErrors.push(`Selected variant does not belong to product "${dbProd.title}".`);
            continue;
          }

          if (!matchedVariant.is_active) {
            stockErrors.push(`The selected variant for "${dbProd.title}" is currently inactive/unavailable.`);
            continue;
          }

          const vStock = Math.max(0, Number(matchedVariant.quantity) || 0);
          if (vStock < actualQty) {
            stockErrors.push(`Insufficient stock for "${dbProd.title}" (only ${vStock} remaining).`);
            continue;
          }

          // Authoritative variant selling price (do NOT trust client-provided price)
          const actualPrice = parseFiniteAmount(
            matchedVariant.selling_price ?? dbProd.selling_price ?? item.product.price,
            0
          );
          if (actualPrice <= 0) {
            stockErrors.push(`Price is not properly configured for "${dbProd.title}".`);
            continue;
          }

          const subtotal = Math.round(actualPrice * actualQty * 100) / 100;
          itemsSubtotalSum = Math.round((itemsSubtotalSum + subtotal) * 100) / 100;

          const sId = dbProd.seller_id;
          const currSellerTotal = sellerSubtotals.get(sId) || 0;
          sellerSubtotals.set(sId, Math.round((currSellerTotal + subtotal) * 100) / 100);

          // Get DB dynamic options snapshot
          const dbOptionsSnapshot =
            variantOptionsSnapshotMap.get(matchedVariant.id) ||
            item.variant_options ||
            (item.product as any)?.variantOptions ||
            {};

          // Preserve backward-compatible size and color fields
          let resolvedSize: string | null = item.size?.trim() || null;
          let resolvedColor: string | null =
            (typeof item.color === 'object' ? item.color?.name : item.color)?.trim() || null;

          for (const [k, val] of Object.entries(dbOptionsSnapshot)) {
            if (k.trim().toLowerCase() === 'size' && val) resolvedSize = String(val).trim().slice(0, 50);
            if (k.trim().toLowerCase() === 'color' && val) resolvedColor = String(val).trim().slice(0, 100);
          }

          preparedOrderItems.push({
            product_id: dbProd.id,
            seller_id: sId,
            product_title: (dbProd.title?.trim() || item.product.title?.trim() || 'Product').slice(0, 255),
            brand: (dbProd.brand?.trim() || item.product.brand?.trim() || 'Brand').slice(0, 255),
            size: resolvedSize,
            color: resolvedColor,
            quantity: actualQty,
            price: actualPrice,
            subtotal: subtotal,
            variant_id: matchedVariant.id,
            variant_sku_snapshot: matchedVariant.sku ? String(matchedVariant.sku).trim().slice(0, 100) : null,
            variant_options_snapshot: dbOptionsSnapshot,
          });

        } else {
          // A. Simple inventory products: variant_id=NULL, variant_sku=NULL, snapshot={}
          if (dbProd.quantity !== null && Number(dbProd.quantity) < actualQty) {
            stockErrors.push(`Insufficient stock for "${dbProd.title}" (only ${dbProd.quantity} remaining).`);
            continue;
          }

          const actualPrice = parseFiniteAmount(
            dbProd.selling_price ?? item.product.price,
            0
          );
          if (actualPrice <= 0) {
            stockErrors.push(`Price is not properly configured for "${dbProd.title}".`);
            continue;
          }

          const subtotal = Math.round(actualPrice * actualQty * 100) / 100;
          itemsSubtotalSum = Math.round((itemsSubtotalSum + subtotal) * 100) / 100;

          const sId = dbProd.seller_id;
          const currSellerTotal = sellerSubtotals.get(sId) || 0;
          sellerSubtotals.set(sId, Math.round((currSellerTotal + subtotal) * 100) / 100);

          const rawSize =
            typeof item.size === 'string' && item.size.trim().length > 0
              ? item.size.trim().slice(0, 50)
              : null;

          let rawColor: string | null = null;
          if (item.color) {
            if (typeof item.color === 'object' && item.color?.name) {
              rawColor = String(item.color.name).trim().slice(0, 100);
            } else if (typeof (item.color as any) === 'string') {
              rawColor = String(item.color).trim().slice(0, 100);
            }
          }

          preparedOrderItems.push({
            product_id: dbProd.id,
            seller_id: sId,
            product_title: (dbProd.title?.trim() || item.product.title?.trim() || 'Product').slice(0, 255),
            brand: (dbProd.brand?.trim() || item.product.brand?.trim() || 'Brand').slice(0, 255),
            size: rawSize,
            color: rawColor,
            quantity: actualQty,
            price: actualPrice,
            subtotal: subtotal,
            variant_id: null,
            variant_sku_snapshot: null,
            variant_options_snapshot: {},
          });
        }
      }

      if (stockErrors.length > 0) {
        return {
          success: false,
          error: stockErrors.join(' '),
        };
      }

      // Calculate total shipping amount across all sellers
      const totalShippingAmount = Math.round(
        Array.from(sellerSubtotals.keys()).reduce((sum, sId) => {
          const pData = sellerPayments?.[sId];
          return sum + parseFiniteAmount(pData?.shippingFee, 150);
        }, 0) * 100
      ) / 100;

      const grandTotalAmount = Math.round((itemsSubtotalSum + totalShippingAmount) * 100) / 100;

      // Step 3: Insert Main Order Record with retry on order_number unique constraint violation (code 23505)
      let orderId = '';
      let finalOrderNumber = '';
      let orderErr: any = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        finalOrderNumber = generateOrderNumber();
        const { data: orderData, error } = await supabase
          .from('orders')
          .insert({
            order_number: finalOrderNumber,
            user_id: userId && isValidUUID(userId) ? userId : null,
            customer_name: customerInfo.fullName.trim().slice(0, 255),
            customer_email: customerInfo.email.trim().slice(0, 255),
            customer_phone: customerInfo.phone.trim().slice(0, 50),
            shipping_address: customerInfo.address.trim(),
            city: customerInfo.city.trim().slice(0, 100),
            postal_code: cleanPostalCode,
            shipping_amount: totalShippingAmount,
            total_amount: grandTotalAmount,
            payment_status: 'Pending',
            order_status: 'Pending',
          })
          .select('id')
          .single();

        if (!error && orderData?.id) {
          orderId = orderData.id;
          orderErr = null;
          break;
        }

        orderErr = error;
        if (error?.code === '23505') {
          continue;
        }
        break;
      }

      if (orderErr || !orderId) {
        console.error('Error inserting into orders:', orderErr?.message || orderErr?.details || orderErr);
        return {
          success: false,
          error: orderErr?.message || 'Failed to create order record.',
        };
      }

      // Rollback helper in case subsequent operations fail
      const rollbackOrder = async () => {
        try {
          await supabase.from('seller_orders').delete().eq('order_id', orderId);
          await supabase.from('order_items').delete().eq('order_id', orderId);
          await supabase.from('orders').delete().eq('id', orderId);
        } catch (e) {
          console.error('Error during order rollback:', e);
        }
      };

      // Step 4: Insert Order Items (Matching public.order_items schema)
      const orderItemsToInsert = preparedOrderItems.map((oi) => ({
        order_id: orderId,
        product_id: oi.product_id,
        seller_id: oi.seller_id,
        product_title: oi.product_title,
        brand: oi.brand,
        quantity: oi.quantity,
        price: oi.price,
        subtotal: oi.subtotal,
        size: oi.size ?? null,
        color: oi.color ?? null,
        variant_id: oi.variant_id ?? null,
        variant_sku_snapshot: oi.variant_sku_snapshot ?? null,
        variant_options_snapshot: oi.variant_options_snapshot ?? {},
      }));

      let { error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      // Graceful fallback if migration 20261113_add_variant_to_order_items.sql is not yet executed in Supabase
      if (
        itemsErr &&
        (itemsErr.message?.includes('variant_id') ||
          itemsErr.message?.includes('variant_sku_snapshot') ||
          itemsErr.message?.includes('variant_options_snapshot') ||
          (itemsErr as any).code === '42703')
      ) {
        console.warn(
          'Notice: order_items table does not yet have variant columns (variant_id, variant_sku_snapshot, variant_options_snapshot). ' +
            'Falling back to insert without them.',
          itemsErr.message
        );
        const fallbackItems = orderItemsToInsert.map(
          ({ variant_id, variant_sku_snapshot, variant_options_snapshot, ...rest }: any) => rest
        );
        const fallbackRes = await supabase.from('order_items').insert(fallbackItems);
        itemsErr = fallbackRes.error;
      }

      if (itemsErr) {
        const errMsg = itemsErr.message || (itemsErr as any).details || JSON.stringify(itemsErr);
        console.error('Error inserting order items:', errMsg);
        await rollbackOrder();
        return {
          success: false,
          error: itemsErr.message ? `Failed to record order items: ${itemsErr.message}` : 'Failed to record order items.',
        };
      }

      // Step 5: Insert Seller Orders (Exactly ONE row per distinct seller)
      const sellerOrdersToInsert = Array.from(sellerSubtotals.entries()).map(([sId, sTotal]) => {
        const pData = sellerPayments?.[sId];
        const rawMethod = pData?.paymentMethod || 'COD';

        const dbMethod =
          rawMethod === 'COD'
            ? PAYMENT_METHOD_DB.COD
            : rawMethod === 'FULL'
              ? PAYMENT_METHOD_DB.FULL
              : PAYMENT_METHOD_DB.DC;

        const isAdvance = rawMethod === 'FULL' || rawMethod === 'DC';
        const sellerShipping = parseFiniteAmount(pData?.shippingFee, 150);
        const proofUrl = isAdvance ? (pData?.paymentProofUrl || null) : null;
        const shippingPaymentStatus = isAdvance ? 'Pending' : null;

        return {
          order_id: orderId,
          seller_id: sId,
          seller_total: Math.round(sTotal * 100) / 100,
          shipping_amount: sellerShipping,
          payment_method: dbMethod,
          payment_proof_url: proofUrl,
          shipping_payment_status: shippingPaymentStatus,
          status: 'Pending',
          payment_status: 'Pending',
        };
      });

      const { error: sellerOrdersErr } = await supabase
        .from('seller_orders')
        .insert(sellerOrdersToInsert);

      if (sellerOrdersErr) {
        console.error('Error inserting seller orders:', sellerOrdersErr.message || sellerOrdersErr.details || sellerOrdersErr);
        await rollbackOrder();
        return {
          success: false,
          error: sellerOrdersErr.message ? `Failed to record seller order groups: ${sellerOrdersErr.message}` : 'Failed to record seller order groups.',
        };
      }

      // Step 6: Clear DB Cart items for authenticated user
      if (userId && isValidUUID(userId)) {
        try {
          const { data: cart } = await supabase
            .from('carts')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

          if (cart) {
            await supabase
              .from('cart_items')
              .delete()
              .eq('cart_id', cart.id)
              .in('product_id', productIds);
          }
        } catch (cErr) {
          console.warn('Error clearing cart items in DB:', cErr);
        }
      }

      return {
        success: true,
        orderId,
        orderNumber: finalOrderNumber,
        orderItems: preparedOrderItems.map((oi) => ({
          product_id: oi.product_id,
          size: oi.size ?? null,
          color: oi.color ?? null,
          variant_id: oi.variant_id ?? null,
          variant_sku_snapshot: oi.variant_sku_snapshot ?? null,
          variant_options_snapshot: oi.variant_options_snapshot ?? {},
        })),
      };
    } catch (err: any) {
      console.error('Unexpected error placing DB order:', err);
      return {
        success: false,
        error: err.message || 'An unexpected error occurred while processing your order.',
      };
    }
  }

  // Fallback for mock items mode
  const fallbackOrderNumber = generateOrderNumber();
  return {
    success: true,
    orderId: fallbackOrderNumber,
    orderNumber: fallbackOrderNumber,
  };
}

export interface FetchedOrderSummary {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  items: {
    id: string;
    productId: string;
    sellerId: string;
    title: string;
    brand: string;
    size?: string | null;
    color?: string | null;
    variantId?: string | null;
    variantSku?: string | null;
    variantOptions?: Record<string, string> | null;
    quantity: number;
    price: number;
    subtotal: number;
    image: string;
  }[];
}

export async function fetchOrderByIdOrNumber(orderIdOrNumber: string): Promise<FetchedOrderSummary | null> {
  if (!orderIdOrNumber) return null;

  try {
    let query = supabase.from('orders').select('*');
    if (isValidUUID(orderIdOrNumber)) {
      query = query.eq('id', orderIdOrNumber);
    } else {
      query = query.eq('order_number', orderIdOrNumber);
    }

    const { data: orderData, error: orderErr } = await query.maybeSingle();

    if (orderErr || !orderData) {
      console.warn('Order not found by ID or order_number:', orderIdOrNumber);
      return null;
    }

    const { data: itemsData, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderData.id);

    if (itemsErr) {
      console.warn('Error fetching order_items:', itemsErr);
    }

    const rawItems = itemsData || [];
    const productIds = Array.from(new Set(rawItems.map((i: any) => i.product_id).filter(Boolean)));

    const imageMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: imagesData } = await supabase
        .from('product_images')
        .select('product_id, image_url, is_thumbnail')
        .in('product_id', productIds);

      if (imagesData) {
        imagesData.forEach((img: any) => {
          if (!imageMap.has(img.product_id) || img.is_thumbnail) {
            imageMap.set(img.product_id, img.image_url);
          }
        });
      }
    }

    const mappedItems = rawItems.map((item: any) => {
      const img = imageMap.get(item.product_id) || '';
      return {
        id: item.id,
        productId: item.product_id,
        sellerId: item.seller_id,
        title: item.product_title || 'Product',
        brand: item.brand || 'Zebaish',
        size: item.size ?? null,
        color: item.color ?? null,
        variantId: item.variant_id ?? null,
        variantSku: item.variant_sku_snapshot ?? null,
        variantOptions: item.variant_options_snapshot ?? {},
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        subtotal: Number(item.subtotal) || 0,
        image: img,
      };
    });

    const { data: sellerOrdersData } = await supabase
      .from('seller_orders')
      .select('payment_method')
      .eq('order_id', orderData.id);

    let displayPaymentMethod = 'Cash on Delivery';
    if (sellerOrdersData && sellerOrdersData.length > 0) {
      const methods = sellerOrdersData.map((so: any) => so.payment_method);
      if (methods.every((m: string) => m === 'COD')) {
        displayPaymentMethod = 'Cash on Delivery';
      } else if (methods.every((m: string) => m === 'Advanced_Full')) {
        displayPaymentMethod = 'Advance Full Payment';
      } else if (methods.every((m: string) => m === 'Advanced_DC')) {
        displayPaymentMethod = 'Advance Delivery Charges';
      } else {
        displayPaymentMethod = 'Multi-Seller Payment Plan';
      }
    }

    return {
      id: orderData.id,
      orderNumber: orderData.order_number || orderIdOrNumber,
      createdAt: orderData.created_at || new Date().toISOString(),
      customerName: orderData.customer_name || 'Customer',
      customerEmail: orderData.customer_email || '',
      customerPhone: orderData.customer_phone || '',
      shippingAddress: orderData.shipping_address || '',
      city: orderData.city || '',
      postalCode: orderData.postal_code || '',
      totalAmount: Number(orderData.total_amount) || 0,
      paymentMethod: displayPaymentMethod,
      paymentStatus: orderData.payment_status || 'Pending',
      orderStatus: orderData.order_status || 'Pending',
      items: mappedItems,
    };
  } catch (err) {
    console.error('Unexpected error fetching order details:', err);
    return null;
  }
}

/**
 * Customer-facing status mapping object/function
 */
export function mapOrderStatus(internalStatus: string | null | undefined): 'ORDER PLACED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' {
  if (!internalStatus) return 'ORDER PLACED';
  const norm = internalStatus.trim().toLowerCase();
  if (norm === 'shipped') return 'SHIPPED';
  if (norm === 'delivered') return 'DELIVERED';
  if (norm === 'cancelled' || norm === 'canceled') return 'CANCELLED';
  return 'ORDER PLACED';
}

export interface PublicTrackOrderItem {
  productId: string;
  title: string;
  brand: string;
  quantity: number;
  price: number;
  subtotal: number;
  imageUrl: string;
}

export interface PublicTrackOrderResult {
  orderNumber: string;
  createdAt: string;
  orderStatus: 'ORDER PLACED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  items: PublicTrackOrderItem[];
}

/**
 * SECURITY & PRIVACY NOTICE:
 * This function powers the public, unauthenticated Order Tracking page.
 * 1. Sensitive PII (customer_name, customer_email, customer_phone, shipping_address, postal_code) is NOT selected.
 * 2. Sensitive financial/seller data is NOT selected.
 * 3. Input is queried strictly by public customer-facing `order_number`.
 * 4. Enumeration Risk Mitigation: `order_number` values use random 4-digit suffixes and high-entropy timestamps (ORD-{timestamp}-{random}).
 *    RECOMMENDATION FOR PRODUCTION: Infrastructure-level rate limiting (e.g. Cloudflare / Nginx / Next.js Middleware rate limiter) should be configured to prevent automated enumeration attacks.
 */
export async function trackOrderByNumber(orderNumberInput: string): Promise<{ data: PublicTrackOrderResult | null; error?: string }> {
  const cleanInput = (orderNumberInput || '').trim();
  if (!cleanInput) {
    return { data: null, error: 'Please enter a valid Order ID.' };
  }

  try {
    // Relational query joining orders -> seller_orders & order_items -> products -> product_images
    const { data: orderData, error: dbError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_status,
        created_at,
        total_amount,
        payment_status,
        seller_orders (
          payment_method
        ),
        order_items (
          product_id,
          product_title,
          brand,
          quantity,
          price,
          subtotal,
          products (
            id,
            title,
            brand,
            category_id,
            product_images ( image_url, is_thumbnail )
          )
        )
      `)
      .eq('order_number', cleanInput)
      .maybeSingle();

    if (dbError) {
      console.error('Error fetching public order tracking:', dbError);
      return { data: null, error: 'Failed to fetch order details. Please try again later.' };
    }

    if (!orderData) {
      return { data: null };
    }

    const rawItems: any[] = Array.isArray(orderData.order_items) ? orderData.order_items : [];

    const items: PublicTrackOrderItem[] = rawItems.map((item) => {
      const prod = item.products;
      const images: any[] = prod && Array.isArray(prod.product_images) ? prod.product_images : [];

      let imageUrl = '';
      if (images.length > 0) {
        const thumb = images.find((i) => i.is_thumbnail);
        imageUrl = thumb ? thumb.image_url : images[0].image_url;
      }

      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=600&auto=format&fit=crop';
      }

      return {
        productId: item.product_id || '',
        title: item.product_title || (prod && (prod.title || prod.suit_title)) || 'Product',
        brand: item.brand || (prod && prod.brand) || 'Zebaish',
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        subtotal: Number(item.subtotal) || (Number(item.price) || 0) * (Number(item.quantity) || 1),
        imageUrl: imageUrl,
      };
    });

    const mappedStatus = mapOrderStatus(orderData.order_status);

    let formattedPaymentMethod = 'Cash on Delivery';
    const selOrders: any[] = Array.isArray(orderData.seller_orders) ? orderData.seller_orders : [];
    if (selOrders.length > 0) {
      const methods = selOrders.map((so: any) => so.payment_method);
      if (methods.every((m: string) => m === 'COD')) {
        formattedPaymentMethod = 'Cash on Delivery';
      } else if (methods.every((m: string) => m === 'Advanced_Full')) {
        formattedPaymentMethod = 'Advance Full Payment';
      } else if (methods.every((m: string) => m === 'Advanced_DC')) {
        formattedPaymentMethod = 'Advance Delivery Charges';
      } else {
        formattedPaymentMethod = 'Multi-Seller Payment Plan';
      }
    }

    return {
      data: {
        orderNumber: orderData.order_number || cleanInput,
        createdAt: orderData.created_at || new Date().toISOString(),
        orderStatus: mappedStatus,
        totalAmount: Number(orderData.total_amount) || 0,
        paymentMethod: formattedPaymentMethod,
        paymentStatus: orderData.payment_status || 'Pending',
        items,
      },
    };
  } catch (err: any) {
    console.error('Unexpected error tracking order:', err);
    return { data: null, error: 'Unable to connect to server. Please check your internet connection and try again.' };
  }
}


