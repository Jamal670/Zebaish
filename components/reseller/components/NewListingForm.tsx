import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Package,
  Tag,
  FileText,
  RefreshCw,
  ShieldAlert,
  Search,
  ChevronDown,
  Check,
  Plus,
} from 'lucide-react';
import { BRANDS } from '@/data/mockData';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';
import useSellerStatus from '@/src/hooks/useSellerStatus';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBrandNamesQuery } from '@/src/hooks/useQueries';

export interface ColorEntry {
  id: string;
  quantity: number;
  color: string;
}

export interface SizeStockEntry {
  id: string;
  quantity: number;
  color: string;
}

export interface ExistingImage {
  id?: string;
  url: string;
  isThumbnail?: boolean;
}

export interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  uploadedUrl: string | null;
  storagePath: string | null;
  status: 'uploading' | 'success' | 'error';
  errorMsg?: string;
}

export interface NewListingFormProps {
  editingListing?: any;
  productId?: string;
  mode?: 'create' | 'edit' | 'restock';
  newListing?: any;
  setNewListing?: React.Dispatch<React.SetStateAction<any>>;
  handleCreateListing?: (e: React.FormEvent) => void;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Sentinel value used exclusively for UI custom entry selection if needed.
 */
export const CUSTOM_SENTINEL = '__custom__';

/**
 * Single named constant representing the "no size" variant marker sent to database
 */
export const NO_SIZE_VALUE = 'Unstitched';

/**
 * Static lookup table for Product Type options keyed by Department and Category
 */
export const PRODUCT_TYPES: Record<string, Record<string, string[]>> = {
  Womens: {
    Clothing: ['Unstitched', 'Ready to wear', 'Kurta', 'Formal', 'Dress', 'Abaya', 'Lehenga', 'Saree', 'Dupatta'],
    Accessories: ['Handbags', 'Jewellery', 'Scarf', 'Belts', 'Sunglasses', 'Watches'],
    Footwear: ['Khussa', 'Flats', 'Sandals', 'Heels', 'Sneakers'],
  },
  Mens: {
    Clothing: ['Shalwar Kameez', 'Kurta', 'Waistcoat', 'Shirt', 'Trouser', 'Suits', 'Pant'],
    Accessories: ['Wallet', 'Belt', 'Watch', 'Sunglasses', 'Tie'],
    Footwear: ['Peshawari Chappal', 'Sandals', 'Formal Shoes', 'Sneakers'],
  },
  Kids: {
    Clothing: ['Kids Suits', 'Shirts & Trouser', 'Frock', 'Baby Clothing', 'Party Wear'],
    Accessories: ['Hair Accessories', 'Bags', 'Caps', 'Belts'],
    Footwear: ['Sandals', 'School Shoes', 'Sneakers'],
  },
};

/**
 * Subcategory (Collection Type) options map preserved from existing data sources
 */
export const CATEGORY_SUBCATEGORIES_MAP: Record<string, string[]> = {
  'Unstitched': [
    '3 Piece Lawn',
    '2 Piece Lawn',
    '1 Piece / Shirt',
    'Chiffon Suits',
    'Linen Suits',
    'Khaddar Suits',
    'Cotton Suits',
    'Cambric Suits',
    'Printed Unstitched',
    'Embroidered Unstitched',
    'Digital Printed',
    'Jacquard / Silk',
  ],
  'Ready to Wear': [
    'Printed Kurtis',
    'Embroidered Kurtis',
    '2 Piece Pret',
    '3 Piece Pret',
    'Luxury Pret',
    'Velvet Pret',
    'Casual Pret',
    'Office / Workwear',
    'Co-Ord Sets',
    'Long Shirts',
    'Trousers & Pants',
  ],
  'Formal': [
    'Chiffon Formals',
    'Organza Dupatta Suit',
    'Embroidered Formal',
    'Luxury Formal',
    'Party Wear',
    'Wedding Guest',
    'Silk Formal',
    'Velvet Formal',
    'Long Frocks',
    'Gharara / Sharara',
    'Maxi',
    'Peplum Suits',
  ],
  'Formals': [
    'Chiffon Formals',
    'Organza Dupatta Suit',
    'Embroidered Formal',
    'Luxury Formal',
    'Party Wear',
    'Wedding Guest',
    'Silk Formal',
    'Velvet Formal',
    'Long Frocks',
    'Gharara / Sharara',
    'Maxi',
    'Peplum Suits',
  ],
  'Accessories': [
    'Bags',
    'Jewellery',
    'Bangles',
    'Clutches',
    'Handbags',
    'Wallets',
    'Scarves / Stoles',
    'Hair Accessories',
    'Bridal Jewellery',
    'Artificial Jewellery',
    'Rings',
    'Earrings',
    'Necklaces',
    'Bracelets',
  ],
};

/**
 * Case-insensitive helper to test if a product type is Unstitched
 */
export function isUnstitched(productType?: string | null): boolean {
  if (!productType) return false;
  return productType.trim().toLowerCase() === 'unstitched';
}

/**
 * Computes available Collection Type options based on product type and category
 */
export function getCollectionTypeOptions(productType?: string | null, category?: string | null): string[] {
  const pt = (productType || '').trim().toLowerCase();
  const cat = (category || '').trim().toLowerCase();

  if (pt === 'unstitched') return CATEGORY_SUBCATEGORIES_MAP['Unstitched'];
  if (pt === 'ready to wear' || pt === 'kurta' || pt === 'shalwar kameez' || pt === 'dress' || pt === 'shirt' || pt === 'trousers & pants' || pt === 'pant' || pt === 'trouser') {
    return CATEGORY_SUBCATEGORIES_MAP['Ready to Wear'];
  }
  if (pt === 'formal' || pt === 'party wear' || pt === 'lehenga' || pt === 'saree' || pt === 'suits') {
    return CATEGORY_SUBCATEGORIES_MAP['Formal'];
  }
  if (cat === 'accessories' || pt === 'handbags' || pt === 'jewellery' || pt === 'bags' || pt === 'wallet' || pt === 'belts' || pt === 'sunglasses' || pt === 'watches') {
    return CATEGORY_SUBCATEGORIES_MAP['Accessories'];
  }

  return CATEGORY_SUBCATEGORIES_MAP['Unstitched'];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function parseSupabaseError(err: any): string {
  if (!err) return 'An unexpected error occurred while saving your collection. Please try again.';

  const message = (err.message || err.error_description || String(err)).toLowerCase();

  if (message.includes('bucket not found') || message.includes('bucket')) {
    return 'Storage configuration issue: Product image storage bucket not found. Please contact support.';
  }
  if (message.includes('storage') || message.includes('object')) {
    return `Storage Upload Issue: ${err.message || 'Permission denied on storage bucket.'}`;
  }
  if (message.includes('row-level security') || message.includes('policy') || message.includes('permission denied')) {
    return 'Permission denied: You can only edit or restock your own listings.';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return 'Network error: Unable to connect to server. Please check your internet connection and try again.';
  }
  if (message.includes('violates foreign key constraint') || message.includes('seller_id')) {
    return 'Seller verification issue: Your seller profile could not be verified. Please re-login.';
  }

  return err.message || 'Failed to save collection listing. Please check your information and try again.';
}

/**
 * Uploads a single image file to Supabase Storage immediately with Data URL fallback
 */
async function uploadSingleFileToStorage(
  file: File,
  sellerId: string,
  itemId: string
): Promise<{ publicUrl: string; path: string }> {
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${Date.now()}_${itemId}_${cleanFileName}`;
  const filePath = `${sellerId}/${fileName}`;
  const targetBucket = 'products';

  try {
    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      console.warn(`Product image storage upload warning (using Data URL fallback):`, uploadError.message);
      const dataUrl = await fileToDataUrl(file);
      return { publicUrl: dataUrl, path: '' };
    }

    const { data: urlData } = supabase.storage.from(targetBucket).getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      const dataUrl = await fileToDataUrl(file);
      return { publicUrl: dataUrl, path: '' };
    }

    return { publicUrl: urlData.publicUrl, path: filePath };
  } catch (err: any) {
    console.warn(`Product image storage upload exception (using Data URL fallback):`, err?.message || err);
    const dataUrl = await fileToDataUrl(file);
    return { publicUrl: dataUrl, path: '' };
  }
}

export function buildInitialProductState(initialProduct: any) {
  // 1. Department detection
  const initialDept = initialProduct?.department || (initialProduct ? 'Womens' : '');

  // 1b. Category (category_type) detection
  let initialCategory = '';
  if (initialProduct) {
    if (initialProduct.category_type && ['Clothing', 'Accessories', 'Footwear'].includes(initialProduct.category_type)) {
      initialCategory = initialProduct.category_type;
    } else if (['Clothing', 'Accessories', 'Footwear'].includes(initialProduct?.category)) {
      initialCategory = initialProduct.category;
    } else if (initialProduct?.category && ['Handbags', 'Jewellery', 'Bags', 'Wallet', 'Belts', 'Sunglasses', 'Watches'].some((a) => a.toLowerCase() === initialProduct.category.toLowerCase())) {
      initialCategory = 'Accessories';
    } else if (initialProduct?.category && ['Heels', 'Flats', 'Sandals', 'Khussa', 'Sneakers', 'Boots', 'Slippers'].some((f) => f.toLowerCase() === initialProduct.category.toLowerCase())) {
      initialCategory = 'Footwear';
    } else {
      initialCategory = 'Clothing';
    }
  }

  const isClothing = initialCategory === 'Clothing';

  // 2. Product Type (category) detection
  let rawProductType = '';
  if (initialProduct) {
    if (initialProduct.category && !['Clothing', 'Accessories', 'Footwear'].includes(initialProduct.category)) {
      rawProductType = initialProduct.category;
    } else if (initialProduct.product_type) {
      rawProductType = initialProduct.product_type;
    } else if (initialCategory === 'Accessories') {
      rawProductType = 'Handbags';
    } else if (initialCategory === 'Footwear') {
      rawProductType = 'Heels';
    } else {
      rawProductType = 'Unstitched';
    }
  }

  // Canonicalize Product Type case from PRODUCT_TYPES if found
  if (initialDept && initialCategory && rawProductType) {
    const validList = PRODUCT_TYPES[initialDept]?.[initialCategory] || [];
    const matched = validList.find((t) => t.toLowerCase() === rawProductType.trim().toLowerCase());
    if (matched) {
      rawProductType = matched;
    }
  }

  // 3. Collection Type (subcategory) detection
  let rawSubcat = '';
  const subcatOptions = getCollectionTypeOptions(rawProductType, initialCategory);
  if (initialProduct && isClothing) {
    rawSubcat = String(initialProduct?.subcategory || initialProduct?.piece_count || '').trim();
    if (rawSubcat) {
      const matchedSub = subcatOptions.find((s) => s.toLowerCase() === rawSubcat.toLowerCase());
      if (matchedSub) {
        rawSubcat = matchedSub;
      }
    }
  }

  // 4. Color lookup: color_id -> color_name
  const colorLookup: Record<string, string> = {};
  const rawColors: any[] = initialProduct?.product_colors || [];
  if (Array.isArray(rawColors)) {
    rawColors.forEach((c) => {
      if (c && c.id) {
        colorLookup[c.id] = c.color_name || '';
      }
    });
  }

  // 5. Existing images
  let initialExistingImages: ExistingImage[] = [];
  if (initialProduct?.product_images && Array.isArray(initialProduct.product_images) && initialProduct.product_images.length > 0) {
    initialExistingImages = initialProduct.product_images.map((img: any) => ({
      id: img.id,
      url: img.image_url || img.url,
      isThumbnail: !!img.is_thumbnail,
    }));
  } else if (initialProduct?.image) {
    const imgs = [initialProduct.image, ...(initialProduct.additionalImages || [])];
    initialExistingImages = imgs.map((url: string, idx: number) => ({ url, isThumbnail: idx === 0 }));
  }

  const rawVariants: any[] = initialProduct?.product_variants || initialProduct?.variants || [];

  // Determine if loaded product has real sizes
  const STANDARD_SIZES = ['Small', 'Medium', 'Large', 'X Large'];
  const standardSizeMap = new Map<string, string>();
  STANDARD_SIZES.forEach((sz) => standardSizeMap.set(sz.toLowerCase(), sz));
  standardSizeMap.set('xlarge', 'X Large');
  standardSizeMap.set('xl', 'X Large');

  const hasRealSizedVariants = Array.isArray(rawVariants) && rawVariants.some((v) => {
    const sz = String(v?.size || '').trim().toLowerCase();
    return sz && sz !== NO_SIZE_VALUE.toLowerCase();
  });

  const initialIsSizedMode = hasRealSizedVariants;

  const initialSelectedSizes: Record<string, number> = {};
  const initialSizeEntries: Record<string, SizeStockEntry[]> = {
    Small: [],
    Medium: [],
    Large: [],
    'X Large': [],
  };
  const initialColorEntries: ColorEntry[] = [];

  if (Array.isArray(rawVariants) && rawVariants.length > 0) {
    if (initialIsSizedMode) {
      rawVariants.forEach((v) => {
        if (!v) return;
        const rawSize = String(v.size || '').trim();
        if (!rawSize) return;

        const lowerSize = rawSize.toLowerCase();
        const canonicalSize = standardSizeMap.get(lowerSize) || rawSize;
        const colorName = v.color_id ? (colorLookup[v.color_id] || '') : (v.color || '');
        const qty = Number(v.quantity) || 0;

        if (!initialSizeEntries[canonicalSize]) {
          initialSizeEntries[canonicalSize] = [];
        }

        initialSizeEntries[canonicalSize].push({
          id: v.id ? String(v.id) : `sz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          quantity: qty,
          color: colorName,
        });

        initialSelectedSizes[canonicalSize] = (initialSelectedSizes[canonicalSize] || 0) + qty;
      });
    } else {
      rawVariants.forEach((v) => {
        if (!v) return;
        const colorName = v.color_id ? (colorLookup[v.color_id] || '') : (v.color || '');
        const qty = Number(v.quantity) || 0;
        initialColorEntries.push({
          id: v.id ? String(v.id) : `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          quantity: qty,
          color: colorName,
        });
      });
    }
  }

  let initialActiveSize: string | null = null;
  if (initialIsSizedMode) {
    const keysWithQty = Object.keys(initialSelectedSizes).filter((k) => initialSelectedSizes[k] > 0);
    initialActiveSize = keysWithQty[0] || Object.keys(initialSelectedSizes)[0] || 'Small';
  }

  const formData = {
    suit_title: initialProduct?.suit_title || initialProduct?.title || '',
    brand: initialProduct?.brand || BRANDS[0] || 'Khaadi',
    fabric: isClothing ? (initialProduct?.fabric || '') : '',
    stitching_status: initialProduct?.category || 'Unstitched',
    piece_count: rawSubcat || subcatOptions[0] || '',
    quantity: '1',
    color: initialProduct?.color || '',
    original_retail_price: String(initialProduct?.original_retail_price || initialProduct?.originalPrice || ''),
    surplus_selling_price: String(initialProduct?.surplus_selling_price || initialProduct?.price || ''),
    defect: initialProduct?.defect || 'None (100% Mint Factory Surplus)',
    description: initialProduct?.description || '',
  };

  return {
    formData,
    department: initialDept,
    category: initialCategory,
    productType: rawProductType,
    collectionType: rawSubcat,
    isSizedMode: initialIsSizedMode,
    existingImages: initialExistingImages,
    selectedSizes: initialSelectedSizes,
    colorEntries: initialColorEntries,
    sizeEntries: initialSizeEntries,
    activeSize: initialActiveSize,
  };
}

/**
 * Shared helper to extract, validate, and deduplicate colors & variants from form state
 */
export function extractAndValidateVariants(
  isSizedMode: boolean,
  selectedSizes: Record<string, number>,
  sizeEntries: Record<string, SizeStockEntry[]>,
  colorEntries: ColorEntry[],
  formDataQuantity: string
): { colors: string[]; variants: { size: string; color: string; quantity: number }[] } {
  interface RawVariantItem {
    size: string;
    quantity: number;
    rawColor: string;
  }
  const rawEntries: RawVariantItem[] = [];

  if (isSizedMode) {
    const allowedSizes = ['Small', 'Medium', 'Large', 'X Large'];
    for (const [sz, qty] of Object.entries(selectedSizes)) {
      if (!allowedSizes.includes(sz)) continue;
      const entriesForSize = (sizeEntries[sz] || []).filter(
        (e) => Number.isInteger(e.quantity) && e.quantity >= 0
      );

      if (entriesForSize.length > 0) {
        for (const e of entriesForSize) {
          const cleanedColor = typeof e.color === 'string' ? e.color.trim().slice(0, 100) : '';
          rawEntries.push({
            size: sz,
            quantity: e.quantity,
            rawColor: cleanedColor,
          });
        }
      } else if (Number(qty) > 0 && Number.isInteger(Number(qty))) {
        rawEntries.push({
          size: sz,
          quantity: Number(qty),
          rawColor: '',
        });
      }
    }
  } else {
    // Unsized mode: submit with NO_SIZE_VALUE ('Unstitched')
    const validEntries = colorEntries.filter(
      (e) => Number.isInteger(e.quantity) && e.quantity >= 0
    );

    if (validEntries.length > 0) {
      for (const e of validEntries) {
        const cleanedColor = typeof e.color === 'string' ? e.color.trim().slice(0, 100) : '';
        rawEntries.push({
          size: NO_SIZE_VALUE,
          quantity: e.quantity,
          rawColor: cleanedColor,
        });
      }
    } else {
      const parsedQty = parseInt(formDataQuantity, 10);
      const safeQty = Number.isInteger(parsedQty) && parsedQty >= 0 ? parsedQty : 1;
      rawEntries.push({
        size: NO_SIZE_VALUE,
        quantity: Math.max(1, safeQty),
        rawColor: '',
      });
    }
  }

  // Colors validation: trim, non-empty, max length 100, case-insensitive uniqueness
  const distinctColorsMap = new Map<string, string>();
  for (const item of rawEntries) {
    const trimmedColor = (item.rawColor || '').trim();
    if (trimmedColor.length > 0) {
      const cappedColor = trimmedColor.slice(0, 100);
      const lower = cappedColor.toLowerCase();
      if (!distinctColorsMap.has(lower)) {
        distinctColorsMap.set(lower, cappedColor);
      }
    }
  }
  const colors: string[] = Array.from(distinctColorsMap.values());

  // Variants validation: size non-empty, quantity integer >= 0, merge duplicate (size+color)
  interface VariantPayload {
    size: string;
    color: string;
    quantity: number;
  }
  const variantMap = new Map<string, VariantPayload>();

  for (const item of rawEntries) {
    const trimmedSize = (item.size || '').trim();
    if (!trimmedSize) {
      throw new Error('Variant size is required and cannot be empty.');
    }

    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      throw new Error(`Quantity for size "${trimmedSize}" must be an integer greater than or equal to 0.`);
    }

    const trimmedColor = (item.rawColor || '').trim().slice(0, 100);
    let canonicalColor = '';
    if (trimmedColor.length > 0) {
      const lower = trimmedColor.toLowerCase();
      if (!distinctColorsMap.has(lower)) {
        throw new Error(`Variant references color "${trimmedColor}" which was not provided in product colors.`);
      }
      canonicalColor = distinctColorsMap.get(lower)!;
    }

    const pairKey = `${trimmedSize.toLowerCase()}:::${canonicalColor.toLowerCase()}`;
    const existing = variantMap.get(pairKey);
    if (existing) {
      existing.quantity += qty;
    } else {
      variantMap.set(pairKey, {
        size: trimmedSize,
        color: canonicalColor,
        quantity: qty,
      });
    }
  }

  const variants = Array.from(variantMap.values());
  return { colors, variants };
}

/**
 * Executes atomic colors & variants replacement (using save_product_colors_and_variants RPC,
 * with fallback to transactional client sequence if the RPC is not deployed).
 */
export async function saveProductColorsAndVariantsAtomically(
  productId: string,
  colors: string[],
  variants: { size: string; color: string; quantity: number }[]
): Promise<void> {
  const { error: rpcErr } = await supabase.rpc('save_product_colors_and_variants', {
    p_product_id: productId,
    p_colors: colors,
    p_variants: variants,
  });

  if (!rpcErr) {
    return;
  }

  // Graceful client-side fallback if RPC is not deployed in Supabase yet (PGRST202)
  if (rpcErr.code === 'PGRST202' || rpcErr.message?.includes('Could not find the function')) {
    // 1. Delete existing variants
    const { error: delVarErr } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId);
    if (delVarErr) throw new Error(`Failed to clear previous variants: ${parseSupabaseError(delVarErr)}`);

    // 2. Delete existing colors
    const { error: delColErr } = await supabase
      .from('product_colors')
      .delete()
      .eq('product_id', productId);
    if (delColErr) throw new Error(`Failed to clear previous colors: ${parseSupabaseError(delColErr)}`);

    // 3. Insert distinct colors
    const colorIdMap = new Map<string, string>();
    if (colors.length > 0) {
      const colorRows = colors.map((c) => ({
        product_id: productId,
        color_name: c,
      }));
      const { data: insertedColors, error: colErr } = await supabase
        .from('product_colors')
        .insert(colorRows)
        .select('id, color_name');
      if (colErr) throw new Error(`Failed to save product colors: ${parseSupabaseError(colErr)}`);
      if (insertedColors && Array.isArray(insertedColors)) {
        for (const c of insertedColors) {
          if (c.color_name && c.id) colorIdMap.set(c.color_name.toLowerCase(), c.id);
        }
      }
    }

    // 4. Insert variants with color_id linkage
    const variantRows = variants.map((v) => ({
      product_id: productId,
      size: v.size,
      quantity: v.quantity,
      color_id: v.color ? colorIdMap.get(v.color.toLowerCase()) || null : null,
    }));

    if (variantRows.length > 0) {
      const { error: varErr } = await supabase
        .from('product_variants')
        .insert(variantRows);
      if (varErr) throw new Error(`Failed to save product variants: ${parseSupabaseError(varErr)}`);
    }

    return;
  }

  throw new Error(`Failed to save product colors and variants: ${parseSupabaseError(rpcErr)}`);
}

interface NewListingFormContentProps {
  initialProduct?: any;
  mode?: 'create' | 'edit' | 'restock';
  onSuccess?: () => void;
  onCancel?: () => void;
  newListing?: any;
  setNewListing?: React.Dispatch<React.SetStateAction<any>>;
  handleCreateListing?: (e: React.FormEvent) => void;
}

const NewListingFormContent: React.FC<NewListingFormContentProps> = ({
  initialProduct = null,
  mode = 'create',
  onSuccess,
  onCancel,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    isRestricted,
    messages: restrictionMessages,
    badgeText,
    formattedRestrictedUntil,
  } = useSellerStatus();
  const isEditMode = mode === 'edit' || mode === 'restock' || !!initialProduct;
  const isRestockMode = mode === 'restock';

  const initialValues = React.useMemo(() => buildInitialProductState(initialProduct), [initialProduct]);

  // Core Form Data
  const [formData, setFormData] = useState(initialValues.formData);

  // Department & Category State
  const [department, setDepartment] = useState<string>(initialValues.department);
  const [category, setCategory] = useState<string>(initialValues.category);
  const isClothing = category === 'Clothing';

  // Product Type State with Inline Custom Dropdown
  const [productType, setProductType] = useState<string>(initialValues.productType);
  const [isProductTypeDropdownOpen, setIsProductTypeDropdownOpen] = useState<boolean>(false);
  const [productTypeSearchTerm, setProductTypeSearchTerm] = useState<string>('');
  const [customProductTypeInput, setCustomProductTypeInput] = useState<string>('');
  const productTypeDropdownRef = useRef<HTMLDivElement>(null);

  // Collection Type State with Inline Custom Dropdown
  const [collectionType, setCollectionType] = useState<string>(initialValues.collectionType);
  const [isCollectionTypeDropdownOpen, setIsCollectionTypeDropdownOpen] = useState<boolean>(false);
  const [collectionTypeSearchTerm, setCollectionTypeSearchTerm] = useState<string>('');
  const [customCollectionTypeInput, setCustomCollectionTypeInput] = useState<string>('');
  const collectionTypeDropdownRef = useRef<HTMLDivElement>(null);

  // Stock Mode State
  const [isSizedMode, setIsSizedMode] = useState<boolean>(initialValues.isSizedMode);

  // Unsized Stock State (uses colorEntries)
  const [colorEntries, setColorEntries] = useState<ColorEntry[]>(initialValues.colorEntries);
  const [unsizedQty, setUnsizedQty] = useState<string>('');
  const [unsizedColor, setUnsizedColor] = useState<string>('');
  const [showUnsizedColorInput, setShowUnsizedColorInput] = useState<boolean>(false);
  const [unsizedInputError, setUnsizedInputError] = useState<string | null>(null);
  const unsizedQtyInputRef = useRef<HTMLInputElement>(null);
  const unsizedColorInputRef = useRef<HTMLInputElement>(null);

  // Sized Stock State
  const [selectedSizes, setSelectedSizes] = useState<Record<string, number>>(initialValues.selectedSizes);
  const [sizeEntries, setSizeEntries] = useState<Record<string, SizeStockEntry[]>>(initialValues.sizeEntries);
  const [sizeDrafts, setSizeDrafts] = useState<Record<string, { quantity: string; color: string }>>({
    Small: { quantity: '', color: '' },
    Medium: { quantity: '', color: '' },
    Large: { quantity: '', color: '' },
    'X Large': { quantity: '', color: '' },
  });
  const [sizeInputError, setSizeInputError] = useState<string | null>(null);
  const sizeQuantityInputRef = useRef<HTMLInputElement>(null);
  const [showSizeColorInput, setShowSizeColorInput] = useState<Record<string, boolean>>({});
  const sizeColorInputRef = useRef<HTMLInputElement>(null);
  const [activeSize, setActiveSize] = useState<string | null>(initialValues.activeSize || 'Small');

  // Images State
  const [existingImages, setExistingImages] = useState<ExistingImage[]>(initialValues.existingImages);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const uploadItemsRef = useRef<UploadItem[]>([]);
  uploadItemsRef.current = uploadItems;

  // General Form States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // TanStack React Query for fetching brandNames table
  const { data: fetchedBrandNames = [], isLoading: isBrandsLoading } = useBrandNamesQuery();

  // Combine fetched brand names with fallback mock BRANDS
  const allBrands = React.useMemo(() => {
    const set = new Set<string>();
    const list: string[] = [];

    const addBrand = (b: string) => {
      if (!b || typeof b !== 'string') return;
      const trimmed = b.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (!set.has(lower)) {
        set.add(lower);
        list.push(trimmed);
      }
    };

    if (Array.isArray(fetchedBrandNames)) {
      fetchedBrandNames.forEach(addBrand);
    }

    if (Array.isArray(BRANDS)) {
      BRANDS.forEach(addBrand);
    }

    return list;
  }, [fetchedBrandNames]);

  // Predefined Defect / Flaw Options
  const PREDEFINED_DEFECTS = React.useMemo(() => [
    'None (100% Mint Factory Surplus)',
    'Minor printing misalignment on hem',
    'Missing original brand cardboard tag',
    'End-of-season clearance roll leftover',
    'Minor embroidery irregularity',
    'Slight color variation from original batch',
    'Minor stitching imperfection',
    'Small fabric weaving irregularity',
  ], []);

  // Dropdown UI states for Brand and Defect
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState<boolean>(false);
  const [isDefectDropdownOpen, setIsDefectDropdownOpen] = useState<boolean>(false);

  const [brandSearchTerm, setBrandSearchTerm] = useState<string>('');
  const [customBrandInput, setCustomBrandInput] = useState<string>('');
  const [customDefectInput, setCustomDefectInput] = useState<string>('');

  const brandDropdownRef = useRef<HTMLDivElement>(null);
  const defectDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(target)) {
        setIsBrandDropdownOpen(false);
      }
      if (productTypeDropdownRef.current && !productTypeDropdownRef.current.contains(target)) {
        setIsProductTypeDropdownOpen(false);
      }
      if (collectionTypeDropdownRef.current && !collectionTypeDropdownRef.current.contains(target)) {
        setIsCollectionTypeDropdownOpen(false);
      }
      if (defectDropdownRef.current && !defectDropdownRef.current.contains(target)) {
        setIsDefectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      uploadItemsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  // Product Type options for current department & category
  const currentProductTypeOptions = React.useMemo(() => {
    if (!department || !category) return [];
    return PRODUCT_TYPES[department]?.[category] || [];
  }, [department, category]);

  const filteredProductTypes = React.useMemo(() => {
    if (!productTypeSearchTerm.trim()) return currentProductTypeOptions;
    const q = productTypeSearchTerm.trim().toLowerCase();
    return currentProductTypeOptions.filter((p) => p.toLowerCase().includes(q));
  }, [currentProductTypeOptions, productTypeSearchTerm]);

  // Collection Type options
  const currentCollectionTypeOptions = React.useMemo(() => {
    return getCollectionTypeOptions(productType, category);
  }, [productType, category]);

  const filteredCollectionTypes = React.useMemo(() => {
    if (!collectionTypeSearchTerm.trim()) return currentCollectionTypeOptions;
    const q = collectionTypeSearchTerm.trim().toLowerCase();
    return currentCollectionTypeOptions.filter((c) => c.toLowerCase().includes(q));
  }, [currentCollectionTypeOptions, collectionTypeSearchTerm]);

  // Filtered brands list based on search term
  const filteredBrands = React.useMemo(() => {
    if (!brandSearchTerm.trim()) return allBrands;
    const q = brandSearchTerm.trim().toLowerCase();
    return allBrands.filter((b) => b.toLowerCase().includes(q));
  }, [allBrands, brandSearchTerm]);

  // Input Change Handlers
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleDepartmentChange = (newDept: string) => {
    setDepartment(newDept);
    if (errors.department) {
      setErrors((prev) => ({ ...prev, department: '' }));
    }

    // Reset Product Type if not valid in new list
    if (newDept && category) {
      const validTypes = PRODUCT_TYPES[newDept]?.[category] || [];
      const match = validTypes.find((t) => t.toLowerCase() === productType.trim().toLowerCase());
      if (match) {
        setProductType(match);
      } else {
        setProductType('');
      }
    } else {
      setProductType('');
    }
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    if (errors.category) {
      setErrors((prev) => ({ ...prev, category: '' }));
    }

    if (newCat !== 'Clothing') {
      setIsCollectionTypeDropdownOpen(false);
      setErrors((prev) => {
        if (!prev.collectionType && !prev.fabric) return prev;
        const next = { ...prev };
        delete next.collectionType;
        delete next.fabric;
        return next;
      });
    }

    // Reset Product Type if not valid in new list
    if (department && newCat) {
      const validTypes = PRODUCT_TYPES[department]?.[newCat] || [];
      const match = validTypes.find((t) => t.toLowerCase() === productType.trim().toLowerCase());
      if (match) {
        setProductType(match);
      } else {
        setProductType('');
      }
    } else {
      setProductType('');
    }
  };

  // Brand Handlers
  const handleSelectBrand = (brandName: string) => {
    handleInputChange('brand', brandName);
    setIsBrandDropdownOpen(false);
    setBrandSearchTerm('');
  };

  const handleAddCustomBrand = () => {
    const trimmed = customBrandInput.trim();
    if (!trimmed) return;

    const existingMatch = allBrands.find(
      (b) => b.toLowerCase() === trimmed.toLowerCase()
    );

    const finalBrandName = existingMatch || trimmed;

    handleInputChange('brand', finalBrandName);
    setCustomBrandInput('');
    setBrandSearchTerm('');
    setIsBrandDropdownOpen(false);
  };

  // Collection Type (Inline Custom Dropdown) Handlers
  const handleSelectCollectionType = (subcat: string) => {
    setCollectionType(subcat);
    setIsCollectionTypeDropdownOpen(false);
    setCollectionTypeSearchTerm('');
    if (errors.collectionType) {
      setErrors((prev) => ({ ...prev, collectionType: '' }));
    }
  };

  const handleAddCustomCollectionType = () => {
    const trimmed = customCollectionTypeInput.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    const existingMatch = currentCollectionTypeOptions.find(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );

    const finalValue = (existingMatch || trimmed).slice(0, 100);

    setCollectionType(finalValue);
    setCustomCollectionTypeInput('');
    setCollectionTypeSearchTerm('');
    setIsCollectionTypeDropdownOpen(false);
    if (errors.collectionType) {
      setErrors((prev) => ({ ...prev, collectionType: '' }));
    }
  };

  // Product Type (Inline Custom Dropdown) Handlers
  const handleSelectProductType = (pt: string) => {
    setProductType(pt);
    setIsProductTypeDropdownOpen(false);
    setProductTypeSearchTerm('');
    if (errors.productType) {
      setErrors((prev) => ({ ...prev, productType: '' }));
    }
  };

  const handleAddCustomProductType = () => {
    const trimmed = customProductTypeInput.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    const existingMatch = currentProductTypeOptions.find(
      (p) => p.toLowerCase() === trimmed.toLowerCase()
    );

    const finalValue = (existingMatch || trimmed).slice(0, 100);

    setProductType(finalValue);
    setCustomProductTypeInput('');
    setProductTypeSearchTerm('');
    setIsProductTypeDropdownOpen(false);
    if (errors.productType) {
      setErrors((prev) => ({ ...prev, productType: '' }));
    }
  };

  const handleAddCustomDefect = () => {
    const trimmed = customDefectInput.trim();
    if (!trimmed) return;

    handleInputChange('defect', trimmed);
    setCustomDefectInput('');
    setIsDefectDropdownOpen(false);
  };

  // Seamless Stock Mode Switch Handler (auto-clears default-mode values when switching to sized mode)
  const handleToggleSizedMode = () => {
    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: '' }));
    }

    if (!isSizedMode) {
      // Switching from Default mode to Sized mode:
      // Automatically clear/reset the quantity and color values entered in default mode
      setColorEntries([]);
      setUnsizedQty('');
      setUnsizedColor('');
      setShowUnsizedColorInput(false);
      setUnsizedInputError(null);

      setIsSizedMode(true);
      if (!activeSize) setActiveSize('Small');
    } else {
      // Switching from Sized mode back to Default mode:
      // Reset size entries and drafts
      setSizeEntries({
        Small: [],
        Medium: [],
        Large: [],
        'X Large': [],
      });
      setSelectedSizes({});
      setSizeDrafts({
        Small: { quantity: '', color: '' },
        Medium: { quantity: '', color: '' },
        Large: { quantity: '', color: '' },
        'X Large': { quantity: '', color: '' },
      });
      setSizeInputError(null);
      setShowSizeColorInput({});

      setIsSizedMode(false);
    }
  };

  // Unsized Stock Entry Handlers
  const handleAddUnsizedEntry = () => {
    const rawQty = unsizedQty.trim();
    const rawColor = unsizedColor.trim().slice(0, 100);

    if (!rawQty) {
      setUnsizedInputError('Please enter a quantity.');
      return;
    }

    if (!/^\d+$/.test(rawQty)) {
      setUnsizedInputError('Quantity must be a whole number (1 or more).');
      return;
    }

    const qtyNum = parseInt(rawQty, 10);
    if (isNaN(qtyNum) || qtyNum < 1) {
      setUnsizedInputError('Quantity must be at least 1.');
      return;
    }

    const isDuplicate = colorEntries.some(
      (entry) => (entry.color || '').trim().toLowerCase() === rawColor.toLowerCase()
    );

    if (isDuplicate) {
      if (rawColor) {
        setUnsizedInputError(`The color "${rawColor}" has already been added.`);
      } else {
        setUnsizedInputError('A stock entry without color has already been added.');
      }
      return;
    }

    const newEntry: ColorEntry = {
      id: `unsized_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      quantity: qtyNum,
      color: rawColor,
    };

    const nextEntries = [...colorEntries, newEntry];
    setColorEntries(nextEntries);
    setUnsizedQty('');
    setUnsizedColor('');
    setShowUnsizedColorInput(false);
    setUnsizedInputError(null);

    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: '' }));
    }

    unsizedQtyInputRef.current?.focus();
  };

  const handleRemoveUnsizedEntry = (id: string) => {
    setColorEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  // Sized Stock Entry Handlers
  const handleToggleSize = (sizeName: string) => {
    if (sizeName in selectedSizes && activeSize === sizeName) {
      setSelectedSizes((prev) => {
        const next = { ...prev };
        delete next[sizeName];
        return next;
      });
      const remaining = Object.keys(selectedSizes).filter((k) => k !== sizeName);
      setActiveSize(remaining.length > 0 ? remaining[0] : null);
      setSizeInputError(null);
    } else if (sizeName in selectedSizes) {
      setActiveSize(sizeName);
      setSizeInputError(null);
    } else {
      const currentEntries = sizeEntries[sizeName] || [];
      const totalQty = currentEntries.reduce((sum, e) => sum + e.quantity, 0);
      setSelectedSizes((prev) => ({
        ...prev,
        [sizeName]: totalQty,
      }));
      setActiveSize(sizeName);
      setSizeInputError(null);
    }

    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: '' }));
    }
  };

  const handleAddSizeStockEntry = () => {
    if (!activeSize) return;

    const currentDraft = sizeDrafts[activeSize] || { quantity: '', color: '' };
    const rawQty = currentDraft.quantity.trim();
    const rawColor = currentDraft.color.trim().slice(0, 100);

    const isColorOpen = !!showSizeColorInput[activeSize] || !!rawColor;

    if (!rawQty) {
      setSizeInputError('Please enter a quantity.');
      return;
    }

    if (!/^\d+$/.test(rawQty)) {
      setSizeInputError('Quantity must be a whole number (1 or more).');
      return;
    }

    const qtyNum = parseInt(rawQty, 10);
    if (isNaN(qtyNum) || qtyNum < 1) {
      setSizeInputError('Quantity must be at least 1.');
      return;
    }

    const currentEntries = sizeEntries[activeSize] || [];

    if (isColorOpen && rawColor) {
      const isDuplicate = currentEntries.some(
        (entry) => (entry.color || '').trim().toLowerCase() === rawColor.toLowerCase()
      );

      if (isDuplicate) {
        setSizeInputError(`The color "${rawColor}" has already been added for ${activeSize}.`);
        return;
      }
    } else if (!rawColor) {
      const hasEmptyColorEntry = currentEntries.some((entry) => !(entry.color || '').trim());
      if (hasEmptyColorEntry) {
        setSizeInputError(`A stock entry without color has already been added for ${activeSize}.`);
        return;
      }
    }

    const newEntry: SizeStockEntry = {
      id: `sz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      quantity: qtyNum,
      color: rawColor,
    };

    const updatedEntries = [...currentEntries, newEntry];

    setSizeEntries((prev) => ({
      ...prev,
      [activeSize]: updatedEntries,
    }));

    setSizeDrafts((prev) => ({
      ...prev,
      [activeSize]: { quantity: '', color: '' },
    }));

    setShowSizeColorInput((prev) => ({
      ...prev,
      [activeSize]: false,
    }));

    setSizeInputError(null);

    const totalQty = updatedEntries.reduce((sum, e) => sum + e.quantity, 0);
    setSelectedSizes((prev) => ({
      ...prev,
      [activeSize]: totalQty,
    }));

    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: '' }));
    }

    sizeQuantityInputRef.current?.focus();
  };

  const handleRemoveSizeStockEntry = (sizeName: string, entryId: string) => {
    const currentEntries = sizeEntries[sizeName] || [];
    const nextEntries = currentEntries.filter((e) => e.id !== entryId);

    setSizeEntries((prev) => ({
      ...prev,
      [sizeName]: nextEntries,
    }));

    if (nextEntries.length === 0) {
      setSelectedSizes((prev) => {
        const next = { ...prev };
        delete next[sizeName];
        return next;
      });

      if (activeSize === sizeName) {
        const remaining = Object.keys(selectedSizes).filter((k) => k !== sizeName);
        setActiveSize(remaining.length > 0 ? remaining[0] : null);
      }
    } else {
      const totalQty = nextEntries.reduce((sum, e) => sum + e.quantity, 0);
      setSelectedSizes((prev) => ({
        ...prev,
        [sizeName]: totalQty,
      }));
    }
  };

  // Image Upload Handling
  const totalImageCount = existingImages.length + uploadItems.length;

  const startBackgroundUpload = async (item: UploadItem, sellerId: string) => {
    try {
      const { publicUrl, path } = await uploadSingleFileToStorage(item.file, sellerId, item.id);
      setUploadItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: 'success', uploadedUrl: publicUrl, storagePath: path, errorMsg: undefined }
            : it
        )
      );
    } catch (err: any) {
      console.warn('Background image upload error:', err);
      setUploadItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: 'error', errorMsg: err?.message || 'Upload failed' }
            : it
        )
      );
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    const availableSlots = 4 - totalImageCount;
    if (availableSlots <= 0) {
      setErrors((prev) => ({ ...prev, images: 'Maximum 4 images allowed per collection.' }));
      return;
    }

    const filesToAdd = files.slice(0, availableSlots);
    const sellerId = user?.id || 'reseller';

    const newItems: UploadItem[] = filesToAdd.map((file, idx) => {
      const id = `img_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        uploadedUrl: null,
        storagePath: null,
        status: 'uploading',
      };
    });

    setUploadItems((prev) => [...prev, ...newItems]);
    if (errors.images) {
      setErrors((prev) => ({ ...prev, images: '' }));
    }

    newItems.forEach((item) => {
      startBackgroundUpload(item, sellerId);
    });

    // Reset input value so same files can be re-selected if removed
    e.target.value = '';
  };

  const handleRetryUpload = (item: UploadItem) => {
    const sellerId = user?.id || 'reseller';
    setUploadItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'uploading', errorMsg: undefined } : it))
    );
    startBackgroundUpload(item, sellerId);
  };

  const handleRemoveExistingImage = (index: number) => {
    const newExisting = existingImages.filter((_, i) => i !== index);
    setExistingImages(newExisting);
    if (newExisting.length + uploadItems.length === 0) {
      setErrors((prev) => ({ ...prev, images: 'Please keep at least 1 image for your collection.' }));
    } else {
      setErrors((prev) => ({ ...prev, images: '' }));
    }
  };

  const handleRemoveUploadItem = (itemId: string) => {
    setUploadItems((prev) => {
      const target = prev.find((it) => it.id === itemId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = prev.filter((it) => it.id !== itemId);
      if (existingImages.length + next.length === 0) {
        setErrors((errs) => ({ ...errs, images: 'Please select at least 1 collection image.' }));
      } else {
        setErrors((errs) => ({ ...errs, images: '' }));
      }
      return next;
    });
  };

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const currentTotal = existingImages.length + uploadItems.length;
    if (currentTotal === 0) {
      newErrors.images = 'Please upload at least 1 image for your collection (maximum 4 allowed).';
    } else if (currentTotal > 4) {
      newErrors.images = 'You cannot upload more than 4 images per collection.';
    }

    if (!formData.suit_title.trim()) {
      newErrors.suit_title = 'Product Title is required.';
    } else if (formData.suit_title.trim().length < 3) {
      newErrors.suit_title = 'Product Title must be at least 3 characters long.';
    }

    if (!department.trim()) {
      newErrors.department = 'Department selection is required.';
    }

    if (!category.trim()) {
      newErrors.category = 'Category selection is required.';
    }

    const effectiveProductType = productType.trim();
    if (!effectiveProductType) {
      newErrors.productType = 'Product Type is required.';
    } else if (effectiveProductType.length > 100) {
      newErrors.productType = 'Product Type cannot exceed 100 characters.';
    }

    if (!formData.brand.trim()) {
      newErrors.brand = 'Brand selection is required.';
    }

    if (isClothing) {
      const effectiveCollectionType = collectionType.trim();
      if (!effectiveCollectionType) {
        newErrors.collectionType = 'Collection Type is required.';
      } else if (effectiveCollectionType.length > 100) {
        newErrors.collectionType = 'Collection Type cannot exceed 100 characters.';
      }

      if (!formData.fabric.trim()) {
        newErrors.fabric = 'Fabric Type is required (e.g. Lawn, Chiffon, Organza).';
      }
    }

    const origPrice = parseFloat(formData.original_retail_price);
    if (!formData.original_retail_price || isNaN(origPrice) || origPrice <= 0) {
      newErrors.original_retail_price = 'Retail Price is required and must be greater than 0.';
    }

    const surplusPrice = parseFloat(formData.surplus_selling_price);
    if (!formData.surplus_selling_price || isNaN(surplusPrice) || surplusPrice <= 0) {
      newErrors.surplus_selling_price = 'Discounted Price is required and must be greater than 0.';
    }

    // Stock Validation
    if (isSizedMode) {
      const totalEntries = Object.values(sizeEntries).reduce((sum, list) => sum + list.length, 0);

      if (totalEntries === 0) {
        newErrors.quantity = 'Please select at least one stock size and add a quantity entry.';
      } else if (activeSize) {
        const draft = sizeDrafts[activeSize];
        if (draft && (draft.quantity.trim() !== '' || draft.color.trim() !== '')) {
          newErrors.quantity = `Click "Add" to save your stock input for ${activeSize} before submitting.`;
        }
      }
    } else {
      if (unsizedQty.trim() || unsizedColor.trim()) {
        newErrors.quantity = 'Click "Add" to save your stock quantity entry before submitting.';
      } else if (colorEntries.length === 0) {
        newErrors.quantity = 'Please add at least one stock quantity entry.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    setSubmitSuccess(null);

    const isValid = validateForm();
    if (!isValid) {
      setSubmitError('Please review and correct the highlighted fields.');
      return;
    }

    setIsSubmitting(true);

    const sellerId = user?.id;
    if (!sellerId) {
      setSubmitError('Authentication Error: Seller ID not found. Please log in to your seller account.');
      setIsSubmitting(false);
      return;
    }

    // Wait for active background image uploads to settle
    let waitAttempts = 0;
    while (uploadItemsRef.current.some((it) => it.status === 'uploading') && waitAttempts < 40) {
      await new Promise((r) => setTimeout(r, 250));
      waitAttempts++;
    }

    const currentUploads = uploadItemsRef.current;
    const failedUploads = currentUploads.filter((it) => it.status === 'error');

    if (failedUploads.length > 0) {
      setSubmitError('One or more selected images failed to upload. Please retry or remove failed images.');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Extract and validate colors & variants
      const { colors: p_colors, variants: p_variants } = extractAndValidateVariants(
        isSizedMode,
        selectedSizes,
        sizeEntries,
        colorEntries,
        '1'
      );

      if (p_variants.length === 0) {
        throw new Error('Cannot save collection: Please specify at least one valid size and quantity.');
      }

      const totalStockQty = p_variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);

      const effectiveProductType = productType.trim();
      const effectiveCollectionType = isClothing ? (collectionType.trim() || null) : null;
      const effectiveFabric = isClothing ? (formData.fabric.trim() || null) : null;

      const productPayload = {
        suit_title: formData.suit_title.trim(),
        department: department.trim(),
        category_type: category.trim(),
        brand: formData.brand.trim(),
        category: effectiveProductType,
        subcategory: effectiveCollectionType,
        fabric: effectiveFabric,
        piece_count: 1,
        color: formData.color.trim() || null,
        original_retail_price: parseFloat(formData.original_retail_price),
        surplus_selling_price: parseFloat(formData.surplus_selling_price),
        defect: formData.defect ? formData.defect.trim() : null,
        description: formData.description ? formData.description.trim() : null,
      };

      if (isEditMode && initialProduct?.id) {
        // Atomically replace colors & variants via RPC
        await saveProductColorsAndVariantsAtomically(initialProduct.id, p_colors, p_variants);

        const newStatus = (initialProduct.status === 'Sold Out' || totalStockQty > 0)
          ? 'Active'
          : (initialProduct.status || 'Active');

        const { error: updateError } = await supabase
          .from('products')
          .update({
            ...productPayload,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialProduct.id)
          .eq('seller_id', sellerId);

        if (updateError) {
          throw new Error(parseSupabaseError(updateError));
        }

        // Batch insert new image records using pre-uploaded URLs
        const newImageRecords = currentUploads
          .filter((it) => it.uploadedUrl)
          .map((it, i) => ({
            product_id: initialProduct.id,
            image_url: it.uploadedUrl!,
            is_thumbnail: existingImages.length === 0 && i === 0,
          }));

        if (newImageRecords.length > 0) {
          const { error: imgErr } = await supabase.from('product_images').insert(newImageRecords);
          if (imgErr) console.warn('Error inserting product_images:', imgErr);
        }

        // Delete removed images if editing
        if (initialProduct.product_images && Array.isArray(initialProduct.product_images)) {
          const remainingUrls = new Set(existingImages.map((img) => img.url));
          const removedImages = initialProduct.product_images.filter((img: any) => !remainingUrls.has(img.image_url));

          for (const removed of removedImages) {
            if (removed.id) {
              await supabase.from('product_images').delete().eq('id', removed.id);
            }
          }
        }

        // Ensure thumbnail flag is updated
        const topUrl = existingImages[0]?.url || newImageRecords[0]?.image_url;
        if (topUrl && initialProduct.id) {
          await supabase.from('product_images').update({ is_thumbnail: false }).eq('product_id', initialProduct.id);
          await supabase
            .from('product_images')
            .update({ is_thumbnail: true })
            .eq('product_id', initialProduct.id)
            .eq('image_url', topUrl);
        }

        // Invalidate query cache
        if (sellerId) {
          queryClient.invalidateQueries({ queryKey: ['sellerProducts', sellerId] });
        }
        if (initialProduct.id) {
          queryClient.invalidateQueries({ queryKey: ['editProduct', initialProduct.id] });
          queryClient.invalidateQueries({ queryKey: ['product', initialProduct.id] });
        }
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['storefront'] });

        setSubmitSuccess(
          isRestockMode ? '🎉 Collection restocked successfully!' : '🎉 Collection updated successfully!'
        );
      } else {
        // CREATE NEW LISTING
        const { data: product, error: productError } = await supabase
          .from('products')
          .insert({
            ...productPayload,
            seller_id: sellerId,
            status: 'Active',
          })
          .select('id')
          .single();

        if (productError || !product?.id) {
          throw new Error(parseSupabaseError(productError));
        }

        const createdProductId = product.id;

        try {
          const imageRecords = currentUploads
            .filter((it) => it.uploadedUrl)
            .map((it, i) => ({
              product_id: createdProductId,
              image_url: it.uploadedUrl!,
              is_thumbnail: i === 0,
            }));

          if (imageRecords.length > 0) {
            const { error: imgErr } = await supabase.from('product_images').insert(imageRecords);
            if (imgErr) throw new Error(parseSupabaseError(imgErr));
          }

          // Atomically save colors and variants via shared RPC helper
          await saveProductColorsAndVariantsAtomically(createdProductId, p_colors, p_variants);
        } catch (postCreateErr: any) {
          // Rollback created product
          try {
            await supabase.from('products').delete().eq('id', createdProductId);
          } catch (rollbackErr) {
            console.error('Failed to rollback created product:', rollbackErr);
          }

          try {
            const storagePaths = currentUploads
              .map((it) => it.storagePath)
              .filter((p): p is string => typeof p === 'string' && p.length > 0);

            if (storagePaths.length > 0) {
              await supabase.storage.from('products').remove(storagePaths);
            }
          } catch (storageCleanupErr) {
            console.warn('Failed to clean up uploaded images from storage:', storageCleanupErr);
          }

          throw postCreateErr;
        }

        setSubmitSuccess('🎉 Collection created successfully with all details, variants and images!');

        // Reset state for new listing
        setFormData({
          suit_title: '',
          brand: BRANDS[0] || 'Khaadi',
          fabric: '',
          stitching_status: 'Unstitched',
          piece_count: '',
          quantity: '1',
          color: '',
          original_retail_price: '',
          surplus_selling_price: '',
          defect: 'None (100% Mint Factory Surplus)',
          description: '',
        });
        setDepartment('');
        setCategory('');
        setProductType('');
        setCustomProductTypeInput('');
        setProductTypeSearchTerm('');
        setCollectionType('');
        setCustomCollectionTypeInput('');
        setCollectionTypeSearchTerm('');
        setIsSizedMode(false);
        setColorEntries([]);
        setUnsizedQty('');
        setUnsizedColor('');
        setShowUnsizedColorInput(false);
        setUnsizedInputError(null);
        setSelectedSizes({});
        setSizeEntries({
          Small: [],
          Medium: [],
          Large: [],
          'X Large': [],
        });
        setSizeDrafts({
          Small: { quantity: '', color: '' },
          Medium: { quantity: '', color: '' },
          Large: { quantity: '', color: '' },
          'X Large': { quantity: '', color: '' },
        });
        setActiveSize('Small');
        setSizeInputError(null);
        setShowSizeColorInput({});
        uploadItemsRef.current.forEach((it) => {
          if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        });
        setUploadItems([]);
        setExistingImages([]);
        setErrors({});
      }

      if (sellerId) {
        queryClient.invalidateQueries({ queryKey: ['sellerProducts', sellerId] });
      }
      if (initialProduct?.id) {
        queryClient.invalidateQueries({ queryKey: ['editProduct', initialProduct.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['storefront'] });

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 500);
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setSubmitError(err?.message || 'Failed to save collection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFormTitle = () => {
    if (isRestockMode) return 'Restock Collection Listing';
    if (isEditMode) return 'Edit Collection Listing';
    return 'Add New Collection Listing';
  };

  const getButtonText = () => {
    if (isSubmitting) {
      if (uploadItems.some((it) => it.status === 'uploading')) {
        return 'Finalizing image uploads...';
      }
      return isRestockMode ? 'Restocking Collection...' : isEditMode ? 'Updating Collection...' : 'Creating Collection...';
    }
    return isRestockMode ? 'Restock Collection' : isEditMode ? 'Update Collection' : 'Add Collection';
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm space-y-6 text-stone-800 animate-fade-in">
      {/* Restricted Seller Warning Banner */}
      {isRestricted && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start space-x-3 text-amber-900 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold flex items-center space-x-2">
              <span>Listing Restricted</span>
              {badgeText && (
                <span className="px-2 py-0.5 text-[10px] uppercase bg-amber-200 text-amber-950 font-extrabold rounded">
                  {badgeText}
                </span>
              )}
            </div>
            <p className="text-amber-800 font-medium">
              {restrictionMessages[0] || 'Your seller account has temporary listing restrictions.'}
            </p>
            {formattedRestrictedUntil && (
              <p className="text-[11px] font-mono text-amber-700">
                Restriction active until: {formattedRestrictedUntil}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-200 pb-4 gap-3">
        <div>
          <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-stone-900 tracking-tight flex items-center space-x-2">
            {isRestockMode ? (
              <RefreshCw className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <Package className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <span>{getFormTitle()}</span>
          </h2>
        </div>

        {isEditMode && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-md border border-stone-300 transition-colors cursor-pointer shrink-0 min-h-[38px]"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {submitError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-md flex items-center space-x-3 text-xs text-red-700 font-medium">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {submitSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center space-x-3 text-xs text-emerald-800 font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6 text-xs sm:text-sm">
        {/* SECTION 1: Photography Gallery (Max 4 Images, Single Horizontal Row) */}
        <div className="space-y-4 bg-stone-50/80 p-4 sm:p-5 rounded-xl border border-stone-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-200 pb-3 gap-2">
            <label className="font-bold text-stone-900 uppercase tracking-wider text-xs sm:text-sm flex items-center space-x-2">
              <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
              <span>1. Collection Photography Gallery (Max 4 Images) <span className="text-red-600">*</span></span>
            </label>
            {totalImageCount > 0 && totalImageCount < 4 && (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 cursor-pointer shadow-2xs transition-colors shrink-0">
                <Plus className="w-3.5 h-3.5 text-stone-600" />
                <span>Add More Photos ({totalImageCount}/4)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Initial Drag-and-Drop Area (Shown ONLY when NO images have been uploaded yet) */}
          {totalImageCount === 0 && (
            <label className="border-2 border-dashed border-stone-300 hover:border-stone-800 bg-white hover:bg-stone-50 transition-colors rounded-lg p-5 sm:p-8 flex flex-col items-center justify-center cursor-pointer text-center shadow-2xs">
              <Upload className="w-8 h-8 text-stone-500 mb-2" />
              <span className="font-bold text-stone-800 text-xs sm:text-sm uppercase tracking-wide mb-1">
                Click to browse or drag collection photos here
              </span>
              <span className="text-[11px] sm:text-xs text-stone-500 max-w-md">
                Supports JPG, PNG, WEBP (Max 4 images). Photos upload automatically in the background!
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          )}

          {errors.images && <p className="text-xs text-red-600 font-medium">{errors.images}</p>}

          {/* Single-Row Horizontal Scrollable Gallery (Never wraps onto a second row) */}
          {totalImageCount > 0 && (
            <div className="flex flex-nowrap overflow-x-auto gap-3 sm:gap-4 pt-1 pb-2 no-scrollbar sm:scrollbar-thin sm:scrollbar-thumb-stone-300 w-full items-stretch">
              {/* Existing Images from DB */}
              {existingImages.map((img, index) => (
                <div
                  key={img.id || img.url || index}
                  className="w-36 sm:w-44 shrink-0 aspect-3/4 relative group border border-stone-300 rounded-md overflow-hidden bg-stone-100 flex flex-col shadow-xs"
                >
                  <img src={img.url} alt={`Existing Image ${index + 1}`} className="w-full h-full object-cover" />
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase rounded-full shadow-sm ${index === 0 ? 'bg-amber-400 text-stone-950' : 'bg-stone-900/80 text-white backdrop-blur-xs'
                      }`}
                  >
                    {index === 0 ? 'Primary' : `Photo ${index + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingImage(index)}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                    title="Remove Image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Background Upload Items with Progress State */}
              {uploadItems.map((item, index) => {
                const combinedIndex = existingImages.length + index;
                return (
                  <div
                    key={item.id}
                    className="w-36 sm:w-44 shrink-0 aspect-3/4 relative group border border-stone-300 rounded-md overflow-hidden bg-stone-100 flex flex-col shadow-xs"
                  >
                    <img src={item.previewUrl} alt={`New Photo ${index + 1}`} className="w-full h-full object-cover" />

                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase rounded-full shadow-sm ${item.status === 'success'
                        ? combinedIndex === 0
                          ? 'bg-amber-400 text-stone-950'
                          : 'bg-emerald-600 text-white'
                        : item.status === 'error'
                          ? 'bg-red-600 text-white'
                          : 'bg-stone-900/80 text-amber-300'
                        }`}
                    >
                      {item.status === 'uploading'
                        ? 'Uploading...'
                        : item.status === 'error'
                          ? 'Failed'
                          : combinedIndex === 0
                            ? 'Primary'
                            : `Ready`}
                    </span>

                    {item.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-1 text-white p-2">
                        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                        <span className="text-[10px] font-bold">Uploading...</span>
                      </div>
                    )}

                    {item.status === 'error' && (
                      <div className="absolute inset-0 bg-red-950/70 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center text-white space-y-2">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        <span className="text-[10px] font-semibold text-red-200 line-clamp-2">
                          {item.errorMsg || 'Upload failed'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRetryUpload(item)}
                          className="px-2 py-1 bg-white text-red-950 text-[10px] font-bold uppercase rounded shadow-sm hover:bg-red-100 flex items-center space-x-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveUploadItem(item.id)}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer z-10"
                      title="Remove Image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Inline Add Photo Card (Visible when at least 1 image uploaded and total < 4) */}
              {totalImageCount < 4 && (
                <label className="w-36 sm:w-44 shrink-0 aspect-3/4 border-2 border-dashed border-stone-300 hover:border-stone-800 bg-white hover:bg-stone-50 transition-colors rounded-md flex flex-col items-center justify-center cursor-pointer text-center p-3 shadow-2xs group">
                  <div className="w-9 h-9 rounded-full bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center mb-1.5 transition-colors">
                    <Plus className="w-5 h-5 text-stone-600" />
                  </div>
                  <span className="font-bold text-stone-800 text-[11px] sm:text-xs uppercase tracking-wide">
                    Add Photo
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    ({totalImageCount}/4)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: Collection Specifications & Pricing */}
        <div className="space-y-5">
          <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs sm:text-sm border-b border-stone-200 pb-2 flex items-center space-x-2">
            <Tag className="w-4 h-4 text-stone-500" />
            <span>2. Collection Specifications & Pricing</span>
          </h3>

          {/* Row 1: Product Title, Department, Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {/* Product Title */}
            <div className="min-w-0">
              <label htmlFor="field-product-title" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Product Title <span className="text-red-600">*</span>
              </label>
              <input
                id="field-product-title"
                type="text"
                placeholder="Embroidered 3PC Lawn Suit"
                value={formData.suit_title}
                onChange={(e) => handleInputChange('suit_title', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] ${
                  errors.suit_title ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                }`}
              />
              {errors.suit_title && <p className="text-xs text-red-600 font-medium mt-1">{errors.suit_title}</p>}
            </div>

            {/* Department */}
            <div className="min-w-0">
              <label htmlFor="field-department" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Department <span className="text-red-600">*</span>
              </label>
              <select
                id="field-department"
                value={department}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  errors.department ? 'border-red-500 focus:border-red-600 text-stone-900' : 'border-stone-300 hover:border-stone-400 focus:border-stone-900 text-stone-900'
                }`}
              >
                <option value="">Select Department</option>
                <option value="Mens">Mens</option>
                <option value="Womens">Womens</option>
                <option value="Kids">Kids</option>
              </select>
              {errors.department && <p className="text-xs text-red-600 font-medium mt-1">{errors.department}</p>}
            </div>

            {/* Category */}
            <div className="min-w-0">
              <label htmlFor="field-category" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Category <span className="text-red-600">*</span>
              </label>
              <select
                id="field-category"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  errors.category ? 'border-red-500 focus:border-red-600 text-stone-900' : 'border-stone-300 hover:border-stone-400 focus:border-stone-900 text-stone-900'
                }`}
              >
                <option value="">Select Category</option>
                <option value="Clothing">Clothing</option>
                <option value="Accessories">Accessories</option>
                <option value="Footwear">Footwear</option>
              </select>
              {errors.category && <p className="text-xs text-red-600 font-medium mt-1">{errors.category}</p>}
            </div>
          </div>

          {/* Row 2: Brand, Product Type, Collection Type (All with Inline Custom Dropdown) */}
          <div className={`grid grid-cols-1 ${isClothing ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 sm:gap-5`}>
            {/* Brand Dropdown */}
            <div className="min-w-0 relative" ref={brandDropdownRef}>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Brand <span className="text-red-600">*</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsBrandDropdownOpen((prev) => !prev);
                  setIsCollectionTypeDropdownOpen(false);
                  setIsProductTypeDropdownOpen(false);
                  setIsDefectDropdownOpen(false);
                }}
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] flex items-center justify-between text-left transition-colors cursor-pointer ${
                  errors.brand ? 'border-red-500 focus:border-red-600' : 'border-stone-300 hover:border-stone-400 focus:border-stone-900'
                }`}
              >
                <span className={`text-xs sm:text-sm font-semibold truncate ${formData.brand ? 'text-stone-900' : 'text-stone-400'}`}>
                  {formData.brand || 'Select Brand'}
                </span>
                <div className="flex items-center space-x-1 shrink-0 text-stone-400">
                  {isBrandsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isBrandDropdownOpen ? 'rotate-180 text-stone-900' : ''}`} />
                </div>
              </button>

              {errors.brand && <p className="text-xs text-red-600 font-medium mt-1">{errors.brand}</p>}

              {isBrandDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-300 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-80 w-full animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="sticky top-0 bg-white border-b border-stone-200 p-2 z-10 shrink-0">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search brand..."
                        value={brandSearchTerm}
                        onChange={(e) => setBrandSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white placeholder-stone-400"
                        autoFocus
                      />
                      {brandSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setBrandSearchTerm('')}
                          className="absolute right-2.5 p-0.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 max-h-48 min-h-[100px]">
                    {isBrandsLoading && filteredBrands.length === 0 ? (
                      <div className="p-4 text-center text-xs text-stone-500 flex items-center justify-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                        <span>Loading brands...</span>
                      </div>
                    ) : filteredBrands.length > 0 ? (
                      filteredBrands.map((b) => {
                        const isSelected = formData.brand === b;
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => handleSelectBrand(b)}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-between cursor-pointer ${isSelected
                              ? 'bg-stone-900 text-white font-bold'
                              : 'text-stone-800 hover:bg-stone-100 hover:text-stone-900'
                              }`}
                          >
                            <span className="truncate">{b}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-xs text-stone-500 font-medium">
                        No brand found matching "{brandSearchTerm}"
                      </div>
                    )}
                  </div>

                  <div className="sticky bottom-0 bg-stone-50 border-t border-stone-200 p-2 z-10 shrink-0">
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        placeholder="Add your own brand name"
                        value={customBrandInput}
                        onChange={(e) => setCustomBrandInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomBrand();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-md text-xs text-stone-900 focus:outline-none focus:border-stone-900 placeholder-stone-400 min-w-0"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomBrand}
                        disabled={!customBrandInput.trim()}
                        className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Product Type (Inline Custom Dropdown matching Brand) */}
            <div className="min-w-0 relative" ref={productTypeDropdownRef}>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Product Type <span className="text-red-600">*</span>
              </label>

              <button
                type="button"
                disabled={!department || !category}
                onClick={() => {
                  if (!department || !category) return;
                  setIsProductTypeDropdownOpen((prev) => !prev);
                  setIsBrandDropdownOpen(false);
                  setIsCollectionTypeDropdownOpen(false);
                  setIsDefectDropdownOpen(false);
                }}
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] flex items-center justify-between text-left transition-colors disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed cursor-pointer ${
                  errors.productType ? 'border-red-500 focus:border-red-600' : 'border-stone-300 hover:border-stone-400 focus:border-stone-900'
                }`}
              >
                <span className={`text-xs sm:text-sm font-semibold truncate ${
                  !department || !category ? 'text-stone-400' : productType ? 'text-stone-900' : 'text-stone-400'
                }`}>
                  {!department || !category
                    ? 'Select Department & Category first'
                    : productType || 'Select Product Type'}
                </span>
                <div className="flex items-center space-x-1 shrink-0 text-stone-400">
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isProductTypeDropdownOpen ? 'rotate-180 text-stone-900' : ''}`} />
                </div>
              </button>

              {errors.productType && <p className="text-xs text-red-600 font-medium mt-1">{errors.productType}</p>}

              {isProductTypeDropdownOpen && department && category && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-300 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-80 w-full animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Sticky Top: Search */}
                  <div className="sticky top-0 bg-white border-b border-stone-200 p-2 z-10 shrink-0">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search product type..."
                        value={productTypeSearchTerm}
                        onChange={(e) => setProductTypeSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white placeholder-stone-400"
                        autoFocus
                      />
                      {productTypeSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setProductTypeSearchTerm('')}
                          className="absolute right-2.5 p-0.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable: Options List */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 max-h-48 min-h-[100px]">
                    {filteredProductTypes.length > 0 ? (
                      filteredProductTypes.map((pt) => {
                        const isSelected = productType === pt;
                        return (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => handleSelectProductType(pt)}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-between cursor-pointer ${isSelected
                              ? 'bg-stone-900 text-white font-bold'
                              : 'text-stone-800 hover:bg-stone-100 hover:text-stone-900'
                              }`}
                          >
                            <span className="truncate">{pt}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-xs text-stone-500 font-medium">
                        No product type found matching "{productTypeSearchTerm}"
                      </div>
                    )}

                    {/* Show custom option if set and not in standard list */}
                    {productType && !currentProductTypeOptions.includes(productType) && (
                      <button
                        type="button"
                        onClick={() => setIsProductTypeDropdownOpen(false)}
                        className="w-full text-left px-3 py-2 text-xs font-bold bg-stone-900 text-white rounded-md flex items-center justify-between cursor-pointer"
                      >
                        <span className="truncate">Custom: {productType}</span>
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      </button>
                    )}
                  </div>

                  {/* Sticky Bottom: Add Custom Product Type */}
                  <div className="sticky bottom-0 bg-stone-50 border-t border-stone-200 p-2 z-10 shrink-0">
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        placeholder="Add custom product type"
                        maxLength={100}
                        value={customProductTypeInput}
                        onChange={(e) => setCustomProductTypeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomProductType();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-md text-xs text-stone-900 focus:outline-none focus:border-stone-900 placeholder-stone-400 min-w-0"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomProductType}
                        disabled={!customProductTypeInput.trim()}
                        className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Collection Type (Inline Custom Dropdown matching Brand) */}
            {isClothing && (
              <div className="min-w-0 relative" ref={collectionTypeDropdownRef}>
                <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                  Collection Type <span className="text-red-600">*</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setIsCollectionTypeDropdownOpen((prev) => !prev);
                    setIsBrandDropdownOpen(false);
                    setIsProductTypeDropdownOpen(false);
                    setIsDefectDropdownOpen(false);
                  }}
                  className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] flex items-center justify-between text-left transition-colors cursor-pointer ${
                    errors.collectionType ? 'border-red-500 focus:border-red-600' : 'border-stone-300 hover:border-stone-400 focus:border-stone-900'
                  }`}
                >
                  <span className={`text-xs sm:text-sm font-semibold truncate ${collectionType ? 'text-stone-900' : 'text-stone-400'}`}>
                    {collectionType || 'Select Collection Type'}
                  </span>
                  <div className="flex items-center space-x-1 shrink-0 text-stone-400">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCollectionTypeDropdownOpen ? 'rotate-180 text-stone-900' : ''}`} />
                  </div>
                </button>

                {errors.collectionType && <p className="text-xs text-red-600 font-medium mt-1">{errors.collectionType}</p>}

                {isCollectionTypeDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-300 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-80 w-full animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Sticky Top: Search */}
                    <div className="sticky top-0 bg-white border-b border-stone-200 p-2 z-10 shrink-0">
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search collection type..."
                          value={collectionTypeSearchTerm}
                          onChange={(e) => setCollectionTypeSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-7 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white placeholder-stone-400"
                          autoFocus
                        />
                        {collectionTypeSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setCollectionTypeSearchTerm('')}
                            className="absolute right-2.5 p-0.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable: Options List */}
                    <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 max-h-48 min-h-[100px]">
                      {filteredCollectionTypes.length > 0 ? (
                        filteredCollectionTypes.map((sub) => {
                          const isSelected = collectionType === sub;
                          return (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => handleSelectCollectionType(sub)}
                              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-between cursor-pointer ${isSelected
                                ? 'bg-stone-900 text-white font-bold'
                                : 'text-stone-800 hover:bg-stone-100 hover:text-stone-900'
                                }`}
                            >
                              <span className="truncate">{sub}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-xs text-stone-500 font-medium">
                          No collection type found matching "{collectionTypeSearchTerm}"
                        </div>
                      )}

                      {/* Show custom option if set and not in current list */}
                      {collectionType && !currentCollectionTypeOptions.includes(collectionType) && (
                        <button
                          type="button"
                          onClick={() => setIsCollectionTypeDropdownOpen(false)}
                          className="w-full text-left px-3 py-2 text-xs font-bold bg-stone-900 text-white rounded-md flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">Custom: {collectionType}</span>
                          <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        </button>
                      )}
                    </div>

                    {/* Sticky Bottom: Add Custom Collection Type */}
                    <div className="sticky bottom-0 bg-stone-50 border-t border-stone-200 p-2 z-10 shrink-0">
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          placeholder="Add custom collection type"
                          maxLength={100}
                          value={customCollectionTypeInput}
                          onChange={(e) => setCustomCollectionTypeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomCollectionType();
                            }
                          }}
                          className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-md text-xs text-stone-900 focus:outline-none focus:border-stone-900 placeholder-stone-400 min-w-0"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomCollectionType}
                          disabled={!customCollectionTypeInput.trim()}
                          className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 3: Fabric Type, Retail Price, Discounted Price */}
          <div className={`grid grid-cols-1 ${isClothing ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 sm:gap-5`}>
            {/* Fabric Type */}
            {isClothing && (
              <div className="min-w-0">
                <label htmlFor="field-fabric-type" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                  Fabric Type <span className="text-red-600">*</span>
                </label>
                <input
                  id="field-fabric-type"
                  type="text"
                  placeholder="Lawn, Chiffon, Organza"
                  value={formData.fabric}
                  onChange={(e) => handleInputChange('fabric', e.target.value)}
                  className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] ${
                    errors.fabric ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
                />
                {errors.fabric && <p className="text-xs text-red-600 font-medium mt-1">{errors.fabric}</p>}
              </div>
            )}

            {/* Retail Price */}
            <div className="min-w-0">
              <label htmlFor="field-retail-price" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Retail Price <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-stone-400 font-bold text-xs">Rs</span>
                <input
                  id="field-retail-price"
                  type="number"
                  min="1"
                  placeholder="6500"
                  value={formData.original_retail_price}
                  onChange={(e) => handleInputChange('original_retail_price', e.target.value)}
                  className={`w-full p-3 pl-10 border rounded-lg focus:outline-none min-h-[42px] ${errors.original_retail_price
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-stone-300 focus:border-stone-900'
                    }`}
                />
              </div>
              {errors.original_retail_price && (
                <p className="text-xs text-red-600 font-medium mt-1">{errors.original_retail_price}</p>
              )}
            </div>

            {/* Discounted Price */}
            <div className="min-w-0">
              <label htmlFor="field-discounted-price" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Discounted Price <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-stone-400 font-bold text-xs">Rs</span>
                <input
                  id="field-discounted-price"
                  type="number"
                  min="1"
                  placeholder="3500"
                  value={formData.surplus_selling_price}
                  onChange={(e) => handleInputChange('surplus_selling_price', e.target.value)}
                  className={`w-full p-3 pl-10 border rounded-lg focus:outline-none min-h-[42px] ${errors.surplus_selling_price
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-stone-300 focus:border-stone-900'
                    }`}
                />
              </div>
              {errors.surplus_selling_price && (
                <p className="text-xs text-red-600 font-medium mt-1">{errors.surplus_selling_price}</p>
              )}
            </div>
          </div>

          {/* Row 4: Stock Size * Section (Two Modes) */}
          <div className="space-y-3 bg-stone-50 p-4 sm:p-5 rounded-xl border border-stone-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2.5">
              <div>
                <label className="font-bold text-stone-900 uppercase tracking-wide text-xs sm:text-sm">
                  Stock Size <span className="text-red-600">*</span>
                </label>
                
              </div>

              <button
                type="button"
                onClick={handleToggleSizedMode}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                  isSizedMode
                    ? 'bg-stone-100 text-stone-800 border-stone-300 hover:bg-stone-200'
                    : 'bg-stone-900 text-white border-stone-900 hover:bg-black shadow-xs'
                }`}
              >
                {isSizedMode ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Disable Sizes</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Sizes</span>
                  </>
                )}
              </button>
            </div>

            {/* MODE 1: Unsized Stock (Default) */}
            {!isSizedMode && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {/* QTY input */}
                    <div className="flex-1 min-w-0">
                      <input
                        ref={unsizedQtyInputRef}
                        type="text"
                        inputMode="numeric"
                        placeholder="Add Quantity"
                        aria-label="Stock Quantity"
                        value={unsizedQty}
                        onChange={(e) => {
                          const numbersOnly = e.target.value.replace(/\D/g, '');
                          setUnsizedQty(numbersOnly);
                          if (unsizedInputError) setUnsizedInputError(null);
                        }}
                        onKeyDown={(e) => {
                          if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                            e.preventDefault();
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddUnsizedEntry();
                          }
                        }}
                        className="w-full p-2.5 text-xs sm:text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 bg-white min-h-[40px]"
                      />
                    </div>

                    {/* Optional Color */}
                    <div className="flex-1 min-w-0">
                      {!showUnsizedColorInput && !unsizedColor ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShowUnsizedColorInput(true);
                            setTimeout(() => unsizedColorInputRef.current?.focus(), 50);
                          }}
                          aria-label="Add Color"
                          className="w-full min-h-[40px] px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-dashed border-stone-300 hover:border-stone-400 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5 text-stone-500" />
                          <span>Add Color (Optional)</span>
                        </button>
                      ) : (
                        <div className="relative w-full">
                          <input
                            ref={unsizedColorInputRef}
                            type="text"
                            maxLength={100}
                            placeholder="Color (Optional)"
                            aria-label="Stock Color"
                            value={unsizedColor}
                            onChange={(e) => {
                              setUnsizedColor(e.target.value);
                              if (unsizedInputError) setUnsizedInputError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddUnsizedEntry();
                              }
                            }}
                            className="w-full p-2.5 pr-8 text-xs sm:text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 bg-white min-h-[40px]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowUnsizedColorInput(false);
                              setUnsizedColor('');
                              if (unsizedInputError) setUnsizedInputError(null);
                            }}
                            aria-label="Cancel color"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Button */}
                  <button
                    type="button"
                    onClick={handleAddUnsizedEntry}
                    aria-label="Add stock entry"
                    className="px-5 py-2.5 text-xs font-bold rounded-lg bg-stone-900 hover:bg-black text-white transition-all cursor-pointer shadow-xs min-h-[40px] shrink-0"
                  >
                    Add
                  </button>
                </div>

                {unsizedInputError && (
                  <p className="text-xs text-red-600 font-medium">{unsizedInputError}</p>
                )}

                {/* Added Unsized Entries Display */}
                {colorEntries.length > 0 && (
                  <div className="pt-2.5 border-t border-stone-200">
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {colorEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white rounded-lg border border-stone-200 shadow-2xs text-xs shrink-0"
                        >
                          {entry.color && (
                            <span className="font-bold text-stone-900 max-w-[140px] truncate" title={entry.color}>
                              {entry.color}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-stone-100 text-stone-700 font-semibold rounded-md text-[11px]">
                            Qty: {entry.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveUnsizedEntry(entry.id)}
                            aria-label={`Remove ${entry.color || 'unsized'} entry`}
                            className="p-0.5 ml-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer text-base leading-none font-bold shrink-0"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: Sized Stock (Activated via Add Sizes) */}
            {isSizedMode && (
              <div className="space-y-3 pt-1">
                {/* Size Selection Buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {['Small', 'Medium', 'Large', 'X Large'].map((sz) => {
                    const isSelected = sz in selectedSizes;
                    const isActive = activeSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => handleToggleSize(sz)}
                        aria-label={`${sz} size${isSelected ? ' selected' : ''}${isActive ? ' editing' : ''}`}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${isSelected
                          ? isActive
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs ring-2 ring-stone-900 ring-offset-1'
                            : 'bg-stone-800 text-white border-stone-800 shadow-2xs'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100 hover:border-stone-400'
                          }`}
                      >
                        {sz} {isSelected ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>

                {/* Active Size QTY and Color Draft Area */}
                {activeSize && activeSize in selectedSizes && (
                  <div className="pt-3 border-t border-stone-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="font-bold text-stone-900 uppercase tracking-wide text-xs">
                        {activeSize} Stock & Color
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {/* QTY input */}
                        <div className="flex-1 min-w-0">
                          <input
                            ref={sizeQuantityInputRef}
                            type="text"
                            inputMode="numeric"
                            placeholder="Add Quantity"
                            aria-label={`${activeSize} Quantity`}
                            value={sizeDrafts[activeSize]?.quantity ?? ''}
                            onChange={(e) => {
                              const numbersOnly = e.target.value.replace(/\D/g, '');
                              setSizeDrafts((prev) => ({
                                ...prev,
                                [activeSize]: { ...prev[activeSize], quantity: numbersOnly },
                              }));
                              if (sizeInputError) setSizeInputError(null);
                            }}
                            onKeyDown={(e) => {
                              if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                                e.preventDefault();
                              }
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSizeStockEntry();
                              }
                            }}
                            className="w-full p-2.5 text-xs sm:text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 bg-white min-h-[40px]"
                          />
                        </div>

                        {/* Optional Color */}
                        <div className="flex-1 min-w-0">
                          {!(showSizeColorInput[activeSize] || sizeDrafts[activeSize]?.color) ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowSizeColorInput((prev) => ({ ...prev, [activeSize]: true }));
                                setTimeout(() => sizeColorInputRef.current?.focus(), 50);
                              }}
                              aria-label="Add Color"
                              className="w-full min-h-[40px] px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-dashed border-stone-300 hover:border-stone-400 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5 text-stone-500" />
                              <span>Add Color (Optional)</span>
                            </button>
                          ) : (
                            <div className="relative w-full">
                              <input
                                ref={sizeColorInputRef}
                                type="text"
                                maxLength={100}
                                placeholder="Color (Optional)"
                                aria-label={`${activeSize} Color`}
                                value={sizeDrafts[activeSize]?.color ?? ''}
                                onChange={(e) => {
                                  setSizeDrafts((prev) => ({
                                    ...prev,
                                    [activeSize]: { ...prev[activeSize], color: e.target.value },
                                  }));
                                  if (sizeInputError) setSizeInputError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSizeStockEntry();
                                  }
                                }}
                                className="w-full p-2.5 pr-8 text-xs sm:text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 bg-white min-h-[40px]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setShowSizeColorInput((prev) => ({ ...prev, [activeSize]: false }));
                                  setSizeDrafts((prev) => ({
                                    ...prev,
                                    [activeSize]: { ...prev[activeSize], color: '' },
                                  }));
                                  if (sizeInputError) setSizeInputError(null);
                                }}
                                aria-label="Cancel color"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 rounded cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={handleAddSizeStockEntry}
                        aria-label={`Add ${activeSize} stock entry`}
                        className="px-5 py-2.5 text-xs font-bold rounded-lg bg-stone-900 hover:bg-black text-white transition-all cursor-pointer shadow-xs min-h-[40px] shrink-0"
                      >
                        Add
                      </button>
                    </div>

                    {sizeInputError && (
                      <p className="text-xs text-red-600 font-medium">{sizeInputError}</p>
                    )}

                    {/* Added Entries Display for Active Size */}
                    {(sizeEntries[activeSize] || []).length > 0 && (
                      <div className="pt-2.5 border-t border-stone-200">
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {(sizeEntries[activeSize] || []).map((entry) => (
                            <div
                              key={entry.id}
                              className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white rounded-lg border border-stone-200 shadow-2xs text-xs shrink-0"
                            >
                              {entry.color && (
                                <span className="font-bold text-stone-900 max-w-[140px] truncate" title={entry.color}>
                                  {entry.color}
                                </span>
                              )}
                              <span className="px-2 py-0.5 bg-stone-100 text-stone-700 font-semibold rounded-md text-[11px]">
                                Qty: {entry.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSizeStockEntry(activeSize, entry.id)}
                                aria-label={`Remove ${entry.color || 'entry'} for ${activeSize}`}
                                className="p-0.5 ml-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer text-base leading-none font-bold shrink-0"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {errors.quantity && <p className="text-xs text-red-600 font-medium pt-1">{errors.quantity}</p>}
          </div>

          {/* Below: Defect Disclaimer & Detailed Description */}
          {/* Defect Disclaimer Dropdown */}
          <div className="relative" ref={defectDropdownRef}>
            <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">Defect / Flaw Disclaimer</label>
            <button
              type="button"
              onClick={() => {
                setIsDefectDropdownOpen((prev) => !prev);
                setIsBrandDropdownOpen(false);
                setIsCollectionTypeDropdownOpen(false);
                setIsProductTypeDropdownOpen(false);
              }}
              className="w-full p-3 border border-stone-300 hover:border-stone-400 focus:border-stone-900 rounded-lg focus:outline-none bg-white min-h-[42px] flex items-center justify-between text-left transition-colors cursor-pointer"
            >
              <span className={`text-xs sm:text-sm font-semibold truncate ${formData.defect ? 'text-stone-900' : 'text-stone-400'}`}>
                {formData.defect || 'Select Defect / Flaw'}
              </span>
              <div className="flex items-center space-x-1 shrink-0 text-stone-400">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDefectDropdownOpen ? 'rotate-180 text-stone-900' : ''}`} />
              </div>
            </button>

            {isDefectDropdownOpen && (
              <div className="absolute left-0 right-0 bottom-full mb-1.5 sm:bottom-auto sm:top-full sm:mt-1.5 bg-white border border-stone-300 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-80 w-full animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 max-h-48 min-h-[100px]">
                  {PREDEFINED_DEFECTS.map((defOption) => {
                    const isSelected = formData.defect === defOption;
                    return (
                      <button
                        key={defOption}
                        type="button"
                        onClick={() => {
                          handleInputChange('defect', defOption);
                          setIsDefectDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-between cursor-pointer ${isSelected
                          ? 'bg-stone-900 text-white font-bold'
                          : 'text-stone-800 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                      >
                        <span className="truncate">{defOption}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}

                  {formData.defect && !PREDEFINED_DEFECTS.includes(formData.defect) && (
                    <button
                      type="button"
                      onClick={() => setIsDefectDropdownOpen(false)}
                      className="w-full text-left px-3 py-2 text-xs font-bold bg-stone-900 text-white rounded-md flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">Custom: {formData.defect}</span>
                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </button>
                  )}
                </div>

                <div className="sticky bottom-0 bg-stone-50 border-t border-stone-200 p-2 z-10 shrink-0">
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      placeholder="Add your item's defect"
                      value={customDefectInput}
                      onChange={(e) => setCustomDefectInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomDefect();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-md text-xs text-stone-900 focus:outline-none focus:border-stone-900 placeholder-stone-400 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomDefect}
                      disabled={!customDefectInput.trim()}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Description */}
          <div>
            <label htmlFor="field-description" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-stone-500" />
              <span>Detailed Description & Fabric Breakdown</span>
            </label>
            <textarea
              id="field-description"
              rows={6}
              placeholder={`Shirt: Printed Centre Panel With Hand-Embellished Organza Detailing...\nTrouser: Printed Culotte Trouser...\nDupatta: Spray Embroidered Medium Silk...`}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 font-mono text-xs leading-relaxed"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-stone-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 sm:py-4 bg-stone-900 hover:bg-black disabled:bg-stone-500 text-white text-xs sm:text-sm font-bold uppercase tracking-widest rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>{getButtonText()}</span>
              </>
            ) : (
              <span>{getButtonText()}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export const NewListingForm: React.FC<NewListingFormProps> = ({
  editingListing = null,
  productId,
  mode = 'create',
  newListing,
  setNewListing,
  handleCreateListing,
  onSuccess,
  onCancel,
}) => {
  const targetProductId = productId || editingListing?.id || null;
  const isEditMode = mode === 'edit' || mode === 'restock' || Boolean(editingListing) || Boolean(productId);

  const {
    data: fetchedProduct,
    isLoading: isProductLoading,
    isError: isProductError,
    error: productError,
    refetch: refetchProduct,
  } = useQuery({
    queryKey: ['editProduct', targetProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          seller_id,
          brand,
          suit_title,
          department,
          category_type,
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
          product_images (
            id,
            image_url,
            is_thumbnail
          ),
          product_variants (
            id,
            size,
            quantity,
            color_id
          ),
          product_colors (
            id,
            color_name
          )
        `)
        .eq('id', targetProductId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: Boolean(targetProductId && isEditMode),
    staleTime: 60 * 1000,
  });

  if (isEditMode && targetProductId && isProductLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-stone-900" />
        <p className="text-sm font-medium text-stone-600">Loading collection listing...</p>
      </div>
    );
  }

  if (isEditMode && targetProductId && isProductError) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 flex flex-col items-center justify-center space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-stone-900">Failed to load listing</h3>
          <p className="text-xs text-stone-500 mt-1">
            {parseSupabaseError(productError) || 'Could not fetch listing details and variants.'}
          </p>
        </div>
        <div className="flex items-center space-x-3 pt-2">
          <button
            type="button"
            onClick={() => refetchProduct()}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors"
          >
            Try Again
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  const effectiveProduct = fetchedProduct || editingListing || null;

  return (
    <NewListingFormContent
      key={targetProductId || 'create'}
      initialProduct={effectiveProduct}
      mode={mode}
      onSuccess={onSuccess}
      onCancel={onCancel}
      newListing={newListing}
      setNewListing={setNewListing}
      handleCreateListing={handleCreateListing}
    />
  );
};

export default NewListingForm;
