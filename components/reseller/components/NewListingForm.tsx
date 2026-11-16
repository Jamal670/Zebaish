import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import {
  createProduct,
  updateProduct,
  safeDeleteProductImageStorageObject,
  setProductStatus,
  mapStatusUpdateError,
} from '@/src/api/productService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useDepartmentsQuery,
  useCategoriesByDepartmentQuery,
  useCategoryAttributeDefinitionsQuery,
  productEditKeys,
  useProductEditCoreQuery,
  useProductEditAttributesQuery,
  useProductEditVariationsQuery,
} from '@/src/hooks/useQueries';
import {
  computeUpdatePatch,
  DirtySectionName,
} from '@/src/utils/computeUpdatePatch';
import {
  useListingDraft,
  AttributeValue,
  CustomSpec,
  VariationDimension,
  VariationRow,
  VariationConfig,
  getPriceRange,
  formatPriceRange,
  normalizeVariationValueKey,
} from '../context/ListingDraftContext';
import { useObjectUrl } from '@/src/hooks/useObjectUrl';
import { AddSpecificationModal } from './AddSpecificationModal';
import { DynamicAttributeField, SearchableSelect } from './CategoryAttributeFields';

function ValueThumbnail({ file, alt }: { file: File; alt: string }) {
  const url = useObjectUrl(file);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      className="w-5 h-5 object-cover rounded border border-stone-200 shrink-0 inline-block mr-1.5 align-middle"
    />
  );
}

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
  storage_path?: string;
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

export const MAX_PRODUCT_IMAGES = 10;

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id.trim());
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
 * Static lookup table for Product Type options keyed by Department and Category (deprecated: fetched dynamically)
 */
export const PRODUCT_TYPES: Record<string, Record<string, string[]>> = {};

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

// ---------------------------------------------------------------------------
// Product Specification persistence (edit mode only)
// ---------------------------------------------------------------------------

interface CustomAttributeRow {
  product_id: string;
  name: string;
  normalized_name: string;
  value: string;
  display_order: number;
}

interface AttributeValueRow {
  product_id: string;
  category_id: string;
  attribute_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_jsonb: string[] | null;
}

interface SpecificationSnapshot {
  customAttributes: CustomAttributeRow[];
  attributeValues: AttributeValueRow[];
}

interface PersistedSpecificationState {
  /** Fresh rows + IDs to hand to the update RPC (so it does not recreate them). */
  customSpecs: Array<{ id?: string; name: string; value: string }>;
  specValues: Record<string, any>;
  /** Best-effort restore of the pre-save snapshot if the product update fails. */
  rollback: () => Promise<void>;
}

const CUSTOM_ATTRIBUTE_SNAPSHOT_COLUMNS = 'product_id, name, normalized_name, value, display_order';
const ATTRIBUTE_VALUE_SNAPSHOT_COLUMNS =
  'product_id, category_id, attribute_id, value_text, value_number, value_boolean, value_jsonb';

/**
 * Re-inserts a previously captured specification snapshot for the tables that
 * were already cleared. Only used when the replacement write fails, so a
 * half-applied delete + insert never leaves the specification tables empty.
 */
async function restoreProductSpecificationRows(
  productId: string,
  snapshot: SpecificationSnapshot,
  cleared: { customAttributes: boolean; attributeValues: boolean }
): Promise<void> {
  const restores: Array<Promise<void>> = [];

  if (cleared.customAttributes) {
    restores.push(
      (async () => {
        const { error: clearError } = await supabase
          .from('product_custom_attributes')
          .delete()
          .eq('product_id', productId);
        if (clearError) throw clearError;
        if (snapshot.customAttributes.length === 0) return;

        const { error: restoreError } = await supabase
          .from('product_custom_attributes')
          .insert(snapshot.customAttributes);
        if (restoreError) throw restoreError;
      })()
    );
  }

  if (cleared.attributeValues) {
    restores.push(
      (async () => {
        const { error: clearError } = await supabase
          .from('product_attribute_values')
          .delete()
          .eq('product_id', productId);
        if (clearError) throw clearError;
        if (snapshot.attributeValues.length === 0) return;

        const { error: restoreError } = await supabase
          .from('product_attribute_values')
          .insert(snapshot.attributeValues);
        if (restoreError) throw restoreError;
      })()
    );
  }

  await Promise.all(restores);
}

export function buildInitialProductStateFromNewSchema(product: any) {
  if (!product) {
    return {
      formData: {
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
      },
      department: '',
      departmentId: '',
      category: '',
      categoryId: '',
      existingImages: [] as ExistingImage[],
      customSpecs: [] as CustomSpec[],
      specValues: {} as Record<string, any>,
      variationConfig: null as VariationConfig | null,
      expectedUpdatedAt: '',
    };
  }

  const formData = {
    suit_title: product.title || '',
    brand: BRANDS[0] || 'Khaadi',
    fabric: '',
    stitching_status: 'Unstitched',
    piece_count: '',
    quantity: String(product.quantity ?? (product.inventory_mode === 'variants' ? 0 : 1)),
    color: '',
    original_retail_price: product.compare_at_price ? String(product.compare_at_price) : '',
    surplus_selling_price: product.selling_price ? String(product.selling_price) : '',
    defect: product.condition_details || 'None (100% Mint Factory Surplus)',
    description: product.description || '',
  };

  const department = product.department?.name || '';
  const departmentId = product.department?.id || '';
  const category = product.category?.name || '';
  const categoryId = product.category_id || '';

  const existingImages: ExistingImage[] = (product.product_images || []).map((img: any) => ({
    id: img.id,
    url: img.image_url || img.url,
    storage_path: img.storage_path,
    isThumbnail: Boolean(img.is_thumbnail),
  }));

  const customSpecs: CustomSpec[] = (product.product_custom_attributes || []).map((ca: any) => ({
    id: ca.id,
    name: ca.name,
    value: ca.value,
  }));

  const specValues: Record<string, any> = {};
  (product.product_attribute_values || []).forEach((pav: any) => {
    if (pav.value_text !== null && pav.value_text !== undefined) specValues[pav.attribute_id] = pav.value_text;
    else if (pav.value_number !== null && pav.value_number !== undefined) specValues[pav.attribute_id] = pav.value_number;
    else if (pav.value_boolean !== null && pav.value_boolean !== undefined) specValues[pav.attribute_id] = pav.value_boolean;
    else if (pav.value_jsonb !== null && pav.value_jsonb !== undefined) specValues[pav.attribute_id] = pav.value_jsonb;
  });

  let variationConfig: VariationConfig | null = null;
  const isVariant =
    product.inventory_mode === 'variants' ||
    (product.product_options && product.product_options.length > 0);

  if (isVariant && product.product_options && product.product_options.length > 0) {
    const dimensions: VariationDimension[] = product.product_options.map((opt: any) => ({
      id: opt.id,
      dbId: opt.id,
      name: opt.name,
      enabled: true,
      values: (opt.values || []).map((v: any) => v.value),
      valueIds: Object.fromEntries((opt.values || []).map((v: any) => [v.value, v.id])),
    }));

    const valueImages: Record<
      string,
      {
        file?: File;
        storagePath?: string;
        imageUrl?: string;
        previewUrl?: string;
        id?: string;
      }
    > = {};
    let imageDimension: string | null = null;

    product.product_options.forEach((opt: any) => {
      (opt.values || []).forEach((val: any) => {
        if (val.image) {
          const key = normalizeVariationValueKey(opt.name, val.value);
          valueImages[key] = {
            id: val.image.id,
            storagePath: val.image.storage_path,
            imageUrl: val.image.image_url,
            previewUrl: val.image.image_url,
          };
          if (!imageDimension) imageDimension = opt.name;
        }
      });
    });

    const valLookup = new Map<string, { optionName: string; value: string }>();
    product.product_options.forEach((opt: any) => {
      (opt.values || []).forEach((v: any) => {
        valLookup.set(v.id, { optionName: opt.name, value: v.value });
      });
    });

    const rows: VariationRow[] = (product.product_variants || []).map((variant: any) => {
      const attributes: Record<string, string> = {};
      (variant.option_value_ids || []).forEach((optValId: string) => {
        const found = valLookup.get(optValId);
        if (found) {
          attributes[found.optionName] = found.value;
        }
      });

      if (Object.keys(attributes).length === 0 && variant.combination_key) {
        const parts = variant.combination_key.split('|');
        parts.forEach((p: string) => {
          const [dName, dVal] = p.split(':');
          if (dName && dVal) {
            const matchedDim = dimensions.find((d) => d.name.toLowerCase() === dName.toLowerCase());
            attributes[matchedDim ? matchedDim.name : dName] = dVal;
          }
        });
      }

      const sortedEntries = Object.keys(attributes)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => [k.toLowerCase(), attributes[k].toLowerCase()]);
      const key = JSON.stringify(sortedEntries);

      const colorKey = Object.keys(attributes).find((k) => k.toLowerCase() === 'color');
      const sizeKey = Object.keys(attributes).find((k) => k.toLowerCase() === 'size');

      return {
        key,
        dbId: variant.id,
        isActive: variant.is_active,
        color: colorKey ? attributes[colorKey] : null,
        size: sizeKey ? attributes[sizeKey] : null,
        attributes,
        price: variant.selling_price ?? '',
        quantity: variant.quantity ?? 0,
      };
    });

    variationConfig = {
      dimensions,
      imageDimension,
      valueImages,
      rows,
    };
  }

  return {
    formData,
    department,
    departmentId,
    category,
    categoryId,
    existingImages,
    customSpecs,
    specValues,
    variationConfig,
    expectedUpdatedAt: product.updated_at || '',
  };
}

// Backwards-compatible alias for any external callers
export const buildInitialProductState = buildInitialProductStateFromNewSchema;

// Old inline section fetchers removed — now in productEditService.ts (used via TanStack Query hooks)

interface NewListingFormContentProps {
  productId?: string | null;
  mode?: 'create' | 'edit' | 'restock';
  onSuccess?: () => void;
  onCancel?: () => void;
  newListing?: any;
  setNewListing?: React.Dispatch<React.SetStateAction<any>>;
  handleCreateListing?: (e: React.FormEvent) => void;
}

const NewListingFormContent: React.FC<NewListingFormContentProps> = ({
  productId = null,
  mode = 'create',
  onSuccess,
  onCancel,
}) => {
  const router = useRouter();
  const {
    formData,
    setFormData,
    department,
    setDepartment,
    departmentId,
    setDepartmentId,
    category,
    setCategory,
    categoryId,
    setCategoryId,
    productType,
    setProductType,
    collectionType,
    setCollectionType,
    specValues,
    setSpecValues,
    extraOptions,
    setExtraOptions,
    customSpecs,
    setCustomSpecs,
    existingImages,
    setExistingImages,
    uploadItems,
    setUploadItems,
    variationConfig,
    setVariationConfig,
    clearDraft,
    editProductId,
    editSections,
    setSectionState,
    initialSnapshots,
    setInitialSnapshot,
    baselineSnapshot,
    setBaselineSnapshot,
    initializedSections,
    isSectionInitialized,
    markSectionInitialized,
    setCategorySelection,
    expectedUpdatedAt,
    setExpectedUpdatedAt,
    startEdit,
    loadedQuery2Definitions,
    setLoadedQuery2Definitions,
    loadedInventoryMode,
    setLoadedInventoryMode,
    productNotFound,
    setProductNotFound,
  } = useListingDraft();

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const sellerId = user?.id;
  const {
    isRestricted,
    messages: restrictionMessages,
    badgeText,
    formattedRestrictedUntil,
  } = useSellerStatus();

  const targetEditId = productId || editProductId || null;
  const isEditMode = mode === 'edit' || mode === 'restock' || Boolean(targetEditId);
  const isRestockMode = mode === 'restock';

  const isClothing = category === 'Clothing';

  // TanStack Query Hooks (Section 3)
  const isTargetIdValid = Boolean(targetEditId && isValidUuid(targetEditId));
  const coreQuery = useProductEditCoreQuery(targetEditId, sellerId, isEditMode && isTargetIdValid);
  const attributesQuery = useProductEditAttributesQuery(targetEditId, sellerId, isEditMode && isTargetIdValid);
  const variationsQuery = useProductEditVariationsQuery(
    targetEditId,
    sellerId,
    isEditMode && isTargetIdValid && coreQuery.isSuccess && loadedInventoryMode === 'variants'
  );

  // Section status flags (Section 3 - v5 trap: isLoading is false for disabled queries)
  const isCoreLoading = isEditMode && coreQuery.isLoading;
  const isCoreError = isEditMode && coreQuery.isError;
  const isCoreLoaded = !isEditMode || coreQuery.isSuccess;

  const isAttributesLoading = isEditMode && attributesQuery.isLoading;
  const isAttributesError = isEditMode && attributesQuery.isError;
  const isAttributesLoaded = !isEditMode || attributesQuery.isSuccess;

  const isVariationsLoading = isEditMode && loadedInventoryMode === 'variants' && variationsQuery.isLoading;
  const isVariationsError = isEditMode && loadedInventoryMode === 'variants' && variationsQuery.isError;
  const isVariationsLoaded = !isEditMode || loadedInventoryMode !== 'variants' || variationsQuery.isSuccess;

  const isAnySectionLoading = isCoreLoading || isAttributesLoading || isVariationsLoading;
  const isAnySectionError = isCoreError || isAttributesError || isVariationsError;
  const isAllRequiredSectionsLoaded = isCoreLoaded && isAttributesLoaded && isVariationsLoaded;

  // Mirror each query's lifecycle into the shared edit-section state.
  // The variation editor relies on this state to know whether the edit draft is
  // ready; without these updates it always saw `idle` and redirected straight back.
  useEffect(() => {
    if (!isEditMode) return;
    setSectionState('core', {
      status: isCoreLoading ? 'loading' : isCoreError ? 'error' : isCoreLoaded ? 'loaded' : 'idle',
      error: isCoreError ? coreQuery.error?.message || 'Failed to load product details' : null,
    });
  }, [isEditMode, isCoreLoading, isCoreError, isCoreLoaded, coreQuery.error, setSectionState]);

  useEffect(() => {
    if (!isEditMode) return;
    setSectionState('attributes', {
      status: isAttributesLoading ? 'loading' : isAttributesError ? 'error' : isAttributesLoaded ? 'loaded' : 'idle',
      error: isAttributesError ? attributesQuery.error?.message || 'Failed to load product specifications' : null,
    });
  }, [
    isEditMode,
    isAttributesLoading,
    isAttributesError,
    isAttributesLoaded,
    attributesQuery.error,
    setSectionState,
  ]);

  useEffect(() => {
    if (!isEditMode) return;
    const status =
      loadedInventoryMode === 'variants'
        ? isVariationsLoading
          ? 'loading'
          : isVariationsError
            ? 'error'
            : variationsQuery.isSuccess
              ? 'loaded'
              : 'idle'
        : 'idle';
    setSectionState('variations', {
      status,
      error: isVariationsError ? variationsQuery.error?.message || 'Failed to load variation combinations' : null,
    });
  }, [
    isEditMode,
    loadedInventoryMode,
    isVariationsLoading,
    isVariationsError,
    variationsQuery.isSuccess,
    variationsQuery.error,
    setSectionState,
  ]);

  // Collection Type State with Inline Custom Dropdown
  const [isCollectionTypeDropdownOpen, setIsCollectionTypeDropdownOpen] = useState<boolean>(false);
  const [collectionTypeSearchTerm, setCollectionTypeSearchTerm] = useState<string>('');
  const [customCollectionTypeInput, setCustomCollectionTypeInput] = useState<string>('');
  const collectionTypeDropdownRef = useRef<HTMLDivElement>(null);

  // Custom Specifications State
  const [isSpecModalOpen, setIsSpecModalOpen] = useState<boolean>(false);
  const addSpecBtnRef = useRef<HTMLButtonElement>(null);

  const uploadItemsRef = useRef<UploadItem[]>([]);
  uploadItemsRef.current = uploadItems;

  // General Form States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const retrySectionLoad = useCallback(
    (section: 'core' | 'attributes' | 'variations') => {
      if (section === 'core') coreQuery.refetch();
      else if (section === 'attributes') attributesQuery.refetch();
      else if (section === 'variations') variationsQuery.refetch();
    },
    [coreQuery, attributesQuery, variationsQuery]
  );

  // Product not found detection
  useEffect(() => {
    if (isEditMode && coreQuery.isSuccess && !coreQuery.data) {
      setProductNotFound(true);
    } else if (coreQuery.data) {
      setProductNotFound(false);
    }
  }, [isEditMode, coreQuery.isSuccess, coreQuery.data, setProductNotFound]);

  // Reset/initialize draft on edit product ID mismatch (initial entry from ListingsView)
  useEffect(() => {
    if (isEditMode && targetEditId && editProductId !== targetEditId) {
      startEdit(targetEditId);
    }
  }, [isEditMode, targetEditId, editProductId, startEdit]);

  // Initialize Core Section once per product (Section 2 & 4)
  useEffect(() => {
    if (!isEditMode || !targetEditId || !coreQuery.data) return;
    if (isSectionInitialized('core', targetEditId)) return;

    const prod = coreQuery.data;
    const cat = prod.category;
    // Self-referencing embed may arrive as an array, so flatten it to the department row
    const rawParent = cat?.parent as any;
    const parentDept = Array.isArray(rawParent) ? rawParent[0] : rawParent;
    const deptId = cat?.parent_id || parentDept?.id || '';
    const deptName = parentDept?.name || '';
    const catId = prod.category_id || cat?.id || '';
    const catName = cat?.name || '';

    // Set all four category fields atomically (Section 4)
    setCategorySelection({
      departmentId: deptId,
      departmentName: deptName,
      categoryId: catId,
      categoryName: catName,
    });

    const invMode = (prod.inventory_mode as 'simple' | 'variants') || 'simple';
    setLoadedInventoryMode(invMode);
    setExpectedUpdatedAt(prod.updated_at || '');

    setFormData((prev) => ({
      ...prev,
      suit_title: prod.title || '',
      description: prod.description || '',
      defect: prod.condition_details || 'None (100% Mint Factory Surplus)',
      surplus_selling_price: prod.selling_price !== null && prod.selling_price !== undefined ? String(prod.selling_price) : '',
      original_retail_price: prod.compare_at_price !== null && prod.compare_at_price !== undefined ? String(prod.compare_at_price) : '',
      quantity: prod.quantity !== null && prod.quantity !== undefined ? String(prod.quantity) : (invMode === 'variants' ? '0' : '1'),
    }));

    const imagesList: ExistingImage[] = (prod.product_images || []).map((img: any) => ({
      id: img.id,
      url: img.image_url,
      storage_path: img.storage_path,
      isThumbnail: Boolean(img.is_thumbnail),
    }));
    setExistingImages(imagesList);

    setBaselineSnapshot((prev: any) => ({
      ...prev,
      expectedUpdatedAt: prod.updated_at || '',
      title: prod.title || '',
      description: prod.description || null,
      defect: prod.condition_details || null,
      inventoryMode: invMode,
      simple: invMode === 'simple'
        ? {
            sellingPrice: Number(prod.selling_price || 0),
            compareAtPrice: prod.compare_at_price !== null && prod.compare_at_price !== undefined ? Number(prod.compare_at_price) : null,
            quantity: Number(prod.quantity || 0),
          }
        : null,
      images: imagesList.map((i) => ({ id: i.id || '', storagePath: i.storage_path, imageUrl: i.url })),
    }));

    markSectionInitialized('core', targetEditId);
  }, [
    isEditMode,
    targetEditId,
    coreQuery.data,
    isSectionInitialized,
    markSectionInitialized,
    setCategorySelection,
    setLoadedInventoryMode,
    setExpectedUpdatedAt,
    setFormData,
    setExistingImages,
    setBaselineSnapshot,
  ]);

  // Initialize Attributes Section once per product (Section 2)
  useEffect(() => {
    if (!isEditMode || !targetEditId || !attributesQuery.data) return;
    if (isSectionInitialized('attributes', targetEditId)) return;

    const { attributeValues, customAttributes } = attributesQuery.data;

    const defs = attributeValues
      .map((av: any) => av.category_attribute_definitions)
      .filter(Boolean);
    setLoadedQuery2Definitions(defs);

    const specVals: Record<string, AttributeValue> = {};
    const extraOpts: Record<string, string[]> = {};

    (attributeValues || []).forEach((av: any) => {
      const def = av.category_attribute_definitions;
      const dataType = def?.data_type;
      const attrId = av.attribute_id;

      if (dataType === 'number') {
        if (av.value_number !== null && av.value_number !== undefined) {
          specVals[attrId] = String(Number(av.value_number));
        }
      } else if (dataType === 'boolean') {
        if (av.value_boolean !== null && av.value_boolean !== undefined) {
          specVals[attrId] = av.value_boolean;
        }
      } else if (dataType === 'multi_select') {
        if (Array.isArray(av.value_jsonb)) {
          specVals[attrId] = av.value_jsonb;
        } else if (typeof av.value_jsonb === 'string') {
          try {
            const parsed = JSON.parse(av.value_jsonb);
            specVals[attrId] = Array.isArray(parsed) ? parsed : [av.value_jsonb];
          } catch {
            specVals[attrId] = [av.value_jsonb];
          }
        }
      } else {
        if (av.value_text !== null && av.value_text !== undefined) {
          specVals[attrId] = av.value_text;
        }
      }

      if (def) {
        const defOptions = def.options || [];
        if (dataType === 'select' && av.value_text && !defOptions.includes(av.value_text)) {
          extraOpts[attrId] = [av.value_text];
        } else if (dataType === 'multi_select' && Array.isArray(specVals[attrId])) {
          const missing = (specVals[attrId] as string[]).filter((v) => !defOptions.includes(v));
          if (missing.length > 0) {
            extraOpts[attrId] = missing;
          }
        }
      }
    });

    const customSpecsList: CustomSpec[] = (customAttributes || []).map((ca: any) => ({
      id: ca.id,
      name: ca.name,
      value: ca.value,
    }));

    setSpecValues(specVals);
    setExtraOptions(extraOpts);
    setCustomSpecs(customSpecsList);

    setBaselineSnapshot((prev: any) => ({
      ...prev,
      customSpecs: customSpecsList.map((s) => ({ id: s.id, name: s.name, value: s.value })),
      specValues: { ...specVals },
    }));

    markSectionInitialized('attributes', targetEditId);
  }, [
    isEditMode,
    targetEditId,
    attributesQuery.data,
    isSectionInitialized,
    markSectionInitialized,
    setLoadedQuery2Definitions,
    setSpecValues,
    setExtraOptions,
    setCustomSpecs,
    setBaselineSnapshot,
  ]);

  // Initialize Variations Section once per product (Section 2)
  useEffect(() => {
    if (!isEditMode || !targetEditId || !variationsQuery.data) return;
    if (loadedInventoryMode !== 'variants') return;
    if (isSectionInitialized('variations', targetEditId)) return;

    const { options, variants } = variationsQuery.data;

    const activeVariants = (variants || []).filter((v: any) => v.is_active);
    const usedValIds = new Set<string>();
    activeVariants.forEach((v: any) => {
      (v.variant_option_values || []).forEach((vov: any) => {
        if (vov.product_option_value_id) {
          usedValIds.add(vov.product_option_value_id);
        }
      });
    });

    const dimensions: VariationDimension[] = (options || []).map((opt: any) => {
      const vals = (opt.product_option_values || []).filter((val: any) => usedValIds.has(val.id));
      const effectiveVals = vals.length > 0 ? vals : (opt.product_option_values || []);
      return {
        id: opt.id,
        dbId: opt.id,
        name: opt.name,
        enabled: true,
        values: effectiveVals.map((v: any) => v.value),
        valueIds: Object.fromEntries(effectiveVals.map((v: any) => [v.value, v.id])),
      };
    });

    const valLookup = new Map<string, { optionName: string; value: string }>();
    (options || []).forEach((opt: any) => {
      (opt.product_option_values || []).forEach((v: any) => {
        valLookup.set(v.id, { optionName: opt.name, value: v.value });
      });
    });

    const rows: VariationRow[] = activeVariants.map((variant: any) => {
      const attributes: Record<string, string> = {};
      (variant.variant_option_values || []).forEach((vov: any) => {
        const found = valLookup.get(vov.product_option_value_id);
        if (found) {
          attributes[found.optionName] = found.value;
        }
      });

      const sortedEntries = Object.keys(attributes)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => [k.toLowerCase(), attributes[k].toLowerCase()]);
      const key = JSON.stringify(sortedEntries);

      const colorKey = Object.keys(attributes).find((k) => k.toLowerCase() === 'color');
      const sizeKey = Object.keys(attributes).find((k) => k.toLowerCase() === 'size');

      return {
        key,
        dbId: variant.id,
        isActive: variant.is_active,
        color: colorKey ? attributes[colorKey] : null,
        size: sizeKey ? attributes[sizeKey] : null,
        attributes,
        price: variant.selling_price ?? '',
        quantity: variant.quantity ?? 0,
      };
    });

    setVariationConfig({
      dimensions,
      rows,
    });

    setBaselineSnapshot((prev: any) => ({
      ...prev,
      variations: {
        dimensions: dimensions.map((d) => ({
          id: d.id,
          name: d.name,
          values: d.values.map((v) => ({ id: d.valueIds?.[v] || '', value: v })),
        })),
        rows: rows.map((r) => ({
          dbId: r.dbId,
          key: r.key,
          price: r.price,
          quantity: r.quantity,
          isActive: r.isActive,
          attributes: r.attributes,
        })),
      },
    }));

    markSectionInitialized('variations', targetEditId);
  }, [
    isEditMode,
    targetEditId,
    variationsQuery.data,
    loadedInventoryMode,
    isSectionInitialized,
    markSectionInitialized,
    setVariationConfig,
    setBaselineSnapshot,
  ]);

  // Variations helper state
  const hasSavedVariations = Boolean(variationConfig && variationConfig.rows && variationConfig.rows.length > 0);

  // Change detection via computeUpdatePatch (Section 5)
  const patchResult = useMemo(() => {
    if (!isEditMode) return { patch: null, isEmpty: false, dirtySections: new Set() as Set<DirtySectionName> };
    return computeUpdatePatch(baselineSnapshot, {
      formData: {
        suit_title: formData.suit_title,
        description: formData.description,
        defect: formData.defect,
        surplus_selling_price: formData.surplus_selling_price,
        original_retail_price: formData.original_retail_price,
        quantity: formData.quantity,
      },
      existingImages,
      uploadItems,
      customSpecs,
      specValues,
      variationConfig,
      loadedInventoryMode,
    });
  }, [
    isEditMode,
    baselineSnapshot,
    formData.suit_title,
    formData.description,
    formData.defect,
    formData.surplus_selling_price,
    formData.original_retail_price,
    formData.quantity,
    existingImages,
    uploadItems,
    customSpecs,
    specValues,
    variationConfig,
    loadedInventoryMode,
  ]);

  const isFormDirty = !isEditMode || !patchResult.isEmpty;

  const variationSummaryText = React.useMemo(() => {
    if (!hasSavedVariations || !variationConfig) return null;
    const parts: string[] = [];
    if (variationConfig.dimensions && variationConfig.dimensions.length > 0) {
      variationConfig.dimensions
        .filter((d) => d.enabled && d.values.length > 0)
        .forEach((d) => {
          parts.push(`${d.name}: ${d.values.length}`);
        });
    } else {
      if (variationConfig.useColor) {
        parts.push(`Colors: ${variationConfig.colors?.length || 0}`);
      }
      if (variationConfig.useSize) {
        parts.push(`Sizes: ${variationConfig.sizes?.length || 0}`);
      }
    }
    const imageCount = variationConfig.valueImages
      ? Object.values(variationConfig.valueImages).filter((entry) => entry?.file instanceof File).length
      : 0;
    if (imageCount > 0) {
      parts.push(`Images: ${imageCount}`);
    }
    parts.push(`Variations: ${variationConfig.rows.length}`);
    const prRange = getPriceRange(variationConfig.rows);
    const prText = formatPriceRange(prRange);
    if (prText) {
      parts.push(prText);
    }
    return parts.join(' | ');
  }, [hasSavedVariations, variationConfig]);

  const handleRemoveVariations = () => {
    const confirmed = window.confirm(
      'Are you sure you want to remove all variations? This will restore single quantity tracking.'
    );
    if (!confirmed) return;
    setVariationConfig(null);
  };

  const handleAddCustomSpec = (newSpec: { name: string; value: string }) => {
    const trimmedName = newSpec.name.trim();
    // Case-insensitive duplicate check against dynamic attributes
    if (mergedAttributeDefinitions.some((a) => a.name.toLowerCase() === trimmedName.toLowerCase())) {
      return;
    }
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? `new_${crypto.randomUUID()}`
      : `new_spec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setCustomSpecs((prev) => [...prev, { id, name: trimmedName, value: newSpec.value }]);
  };

  const handleRemoveCustomSpec = (id: string) => {
    setCustomSpecs((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateCustomSpecValue = (id: string, newValue: string) => {
    setCustomSpecs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, value: newValue } : s))
    );
  };

  // TanStack React Query for fetching top-level departments (categories where parent_id is null)
  // Disabled in edit mode — department/category are read-only (Section 4)
  const {
    data: departments = [],
    isLoading: isDepartmentsLoading,
    isError: isDepartmentsError,
    refetch: refetchDepartments,
  } = useDepartmentsQuery({ enabled: !isEditMode });

  // Determine effective department ID: from state or matched against fetched departments by name
  const effectiveDepartmentId = React.useMemo(() => {
    if (departmentId) return departmentId;
    if (department && departments.length > 0) {
      const match = departments.find(
        (d) => d.name.toLowerCase() === department.trim().toLowerCase() || d.id === department
      );
      if (match) return match.id;
    }
    return '';
  }, [departmentId, department, departments]);

  useEffect(() => {
    if (!departmentId && effectiveDepartmentId) {
      setDepartmentId(effectiveDepartmentId);
    }
  }, [effectiveDepartmentId, departmentId, setDepartmentId]);

  // Fallback dropdown options: ensures current department renders immediately in edit mode without resets
  const departmentOptions = React.useMemo(() => {
    const list = departments.map((dept) => ({ value: dept.id, label: dept.name }));
    if (departmentId && !list.some((o) => o.value === departmentId)) {
      list.unshift({ value: departmentId, label: department || 'Current Department' });
    }
    return list;
  }, [departments, departmentId, department]);

  // TanStack React Query for fetching child categories of selected department (parent_id = effectiveDepartmentId)
  // Disabled in edit mode — department/category are read-only (Section 4)
  const {
    data: childCategories = [],
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
    refetch: refetchCategories,
  } = useCategoriesByDepartmentQuery(effectiveDepartmentId || null, { enabled: !isEditMode });

  // Determine effective category ID: from state or matched against child categories by name
  const effectiveCategoryId = React.useMemo(() => {
    if (categoryId) return categoryId;
    if (category && childCategories.length > 0) {
      const match = childCategories.find(
        (c) => c.name.toLowerCase() === category.trim().toLowerCase() || c.id === category
      );
      if (match) return match.id;
    }
    return '';
  }, [categoryId, category, childCategories]);

  useEffect(() => {
    if (!categoryId && effectiveCategoryId) {
      setCategoryId(effectiveCategoryId);
    }
  }, [effectiveCategoryId, categoryId, setCategoryId]);

  // Fallback dropdown options: ensures current category renders immediately in edit mode without resets
  const categoryOptions = React.useMemo(() => {
    const list = childCategories.map((cat) => ({ value: cat.id, label: cat.name }));
    if (categoryId && !list.some((o) => o.value === categoryId)) {
      list.unshift({ value: categoryId, label: category || 'Current Category' });
    }
    return list;
  }, [childCategories, categoryId, category]);

  // TanStack React Query for fetching category attribute definitions (category_id = effectiveCategoryId)
  const {
    data: fetchedAttributeDefinitions = [],
    isLoading: isCategoryDefsLoading,
    isError: isCategoryDefsError,
    refetch: refetchCategoryDefs,
  } = useCategoryAttributeDefinitionsQuery(effectiveCategoryId || null);

  // Merge active category attribute definitions with loaded Query 2 definitions (preserves deactivated definitions)
  const mergedAttributeDefinitions = React.useMemo(() => {
    const map = new Map<string, any>();
    if (isEditMode && Array.isArray(loadedQuery2Definitions)) {
      loadedQuery2Definitions.forEach((d) => {
        if (d && d.id) map.set(d.id, d);
      });
    }
    (fetchedAttributeDefinitions || []).forEach((d) => {
      if (d && d.id) map.set(d.id, d);
    });
    return Array.from(map.values()).sort((a, b) => {
      const orderA = a.sort_order ?? 9999;
      const orderB = b.sort_order ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [isEditMode, loadedQuery2Definitions, fetchedAttributeDefinitions]);

  const handleRetryUpload = (item: UploadItem) => {
    setUploadItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'success', errorMsg: undefined } : it))
    );
  };

  const handleSpecValueChange = (attrId: string, attrName: string, val: AttributeValue) => {
    setSpecValues((prev) => ({
      ...prev,
      [attrId]: val,
    }));

    const lowerName = attrName.toLowerCase();
    const stringVal = Array.isArray(val)
      ? val.join(', ')
      : typeof val === 'boolean'
        ? (val ? 'Yes' : 'No')
        : String(val ?? '');

    if (lowerName === 'product type' || lowerName === 'type') {
      setProductType(stringVal);
      if (errors.productType) {
        setErrors((prev) => ({ ...prev, productType: '' }));
      }
    } else if (lowerName === 'fabric' || lowerName === 'fabric type') {
      handleInputChange('fabric', stringVal);
    }

    if (errors[`attr_${attrId}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`attr_${attrId}`];
        return next;
      });
    }
  };

  const handleAddExtraOption = (attrId: string, newOption: string) => {
    setExtraOptions((prev) => {
      const existing = prev[attrId] || [];
      if (existing.some((opt) => opt.toLowerCase() === newOption.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        [attrId]: [...existing, newOption],
      };
    });
  };

  // Predefined brand options from static BRANDS list
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

    if (Array.isArray(BRANDS)) {
      BRANDS.forEach(addBrand);
    }

    return list;
  }, []);

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
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleDepartmentChange = (newDeptId: string, newDeptName?: string) => {
    // Department cannot be changed in edit mode (Section 4)
    if (isEditMode) return;

    setDepartmentId(newDeptId);
    const selectedDept = departments.find((d) => d.id === newDeptId);
    const deptName = newDeptName || (selectedDept ? selectedDept.name : '');
    setDepartment(deptName);

    // Dependent dropdown behavior: Whenever selected Department changes, clear previously selected Category and specifications to prevent stale data
    setCategory('');
    setCategoryId('');
    setProductType('');
    setSpecValues({});
    setExtraOptions({});
    setCustomSpecs([]);

    if (errors.department) {
      setErrors((prev) => ({ ...prev, department: '' }));
    }
    if (errors.category) {
      setErrors((prev) => ({ ...prev, category: '' }));
    }
  };

  const handleCategoryChange = (newCatId: string, newCatName?: string) => {
    // Category cannot be changed in edit mode (Section 4)
    if (isEditMode) return;

    setCategoryId(newCatId);
    const selectedCat = childCategories.find((c) => c.id === newCatId);
    const catName = newCatName || (selectedCat ? selectedCat.name : '');
    setCategory(catName);

    // Reset specifications when category changes to prevent stale data
    setSpecValues({});
    setExtraOptions({});
    setCustomSpecs([]);
    setProductType('');

    if (errors.category) {
      setErrors((prev) => ({ ...prev, category: '' }));
    }

    if (catName !== 'Clothing') {
      setIsCollectionTypeDropdownOpen(false);
      setErrors((prev) => {
        if (!prev.collectionType && !prev.fabric) return prev;
        const next = { ...prev };
        delete next.collectionType;
        delete next.fabric;
        return next;
      });
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


  const handleAddCustomDefect = () => {
    const trimmed = customDefectInput.trim();
    if (!trimmed) return;

    handleInputChange('defect', trimmed);
    setCustomDefectInput('');
    setIsDefectDropdownOpen(false);
  };

  // Image Upload Handling
  const totalImageCount = existingImages.length + uploadItems.length;

  const processImageFiles = (files: File[]) => {
    if (!files || files.length === 0) return;

    const availableSlots = MAX_PRODUCT_IMAGES - (existingImages.length + uploadItems.length);
    if (availableSlots <= 0) {
      setErrors((prev) => ({
        ...prev,
        images: `Maximum ${MAX_PRODUCT_IMAGES} images allowed per collection.`,
      }));
      return;
    }

    if (files.length > availableSlots) {
      setErrors((prev) => ({
        ...prev,
        images: `You can only add ${availableSlots} more image${availableSlots > 1 ? 's' : ''}. Only the first ${availableSlots} ${availableSlots > 1 ? 'photos were' : 'photo was'} added.`,
      }));
    } else if (errors.images) {
      setErrors((prev) => ({ ...prev, images: '' }));
    }

    const filesToAdd = files.slice(0, availableSlots);

    const newItems: UploadItem[] = filesToAdd.map((file, idx) => {
      const id = `img_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        uploadedUrl: null,
        storagePath: null,
        status: 'success',
      };
    });

    setUploadItems((prev: UploadItem[]) => [...prev, ...newItems]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    processImageFiles(files);
    // Reset input value so same files can be re-selected if removed
    e.target.value = '';
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
    setUploadItems((prev: UploadItem[]) => {
      const target = prev.find((it: UploadItem) => it.id === itemId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = prev.filter((it: UploadItem) => it.id !== itemId);
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
      newErrors.images = `Please upload at least 1 image for your collection (maximum ${MAX_PRODUCT_IMAGES} allowed).`;
    } else if (currentTotal > MAX_PRODUCT_IMAGES) {
      newErrors.images = `You cannot upload more than ${MAX_PRODUCT_IMAGES} images per collection.`;
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

    // Dynamic Attribute Specifications Validation (based on backend is_required flag)
    mergedAttributeDefinitions.forEach((attr) => {
      if (attr.is_required) {
        const val = specValues[attr.id];
        let isEmpty = false;

        if (attr.data_type === 'multi_select') {
          isEmpty = !Array.isArray(val) || val.length === 0;
        } else if (attr.data_type === 'boolean') {
          isEmpty = typeof val !== 'boolean';
        } else if (attr.data_type === 'number') {
          isEmpty = val === undefined || val === null || String(val).trim() === '' || isNaN(Number(val));
        } else {
          isEmpty = val === undefined || val === null || String(val).trim() === '';
        }

        if (isEmpty) {
          // Intentional removal: while editing, a previously saved specification that
          // the seller deliberately cleared / removed must not block the update from saving.
          const baselineVal = (baselineSnapshot?.specValues || {})[attr.id];
          const hadBaselineValue =
            baselineVal !== undefined &&
            baselineVal !== null &&
            baselineVal !== '' &&
            !(Array.isArray(baselineVal) && baselineVal.length === 0);

          if (!(isEditMode && hadBaselineValue)) {
            newErrors[`attr_${attr.id}`] = `${attr.name} is required.`;
          }
        }
      }
    });

    if (!formData.brand.trim()) {
      newErrors.brand = 'Brand selection is required.';
    }

    if (isClothing) {
      const dynCollectionAttr = mergedAttributeDefinitions.find(
        (a) => a.name.toLowerCase() === 'collection type' || a.name.toLowerCase() === 'subcategory'
      );
      const dynFabricAttr = mergedAttributeDefinitions.find(
        (a) => a.name.toLowerCase() === 'fabric' || a.name.toLowerCase() === 'fabric type'
      );

      const effectiveCollectionType = (
        (dynCollectionAttr ? String(specValues[dynCollectionAttr.id] || '') : '') ||
        collectionType.trim()
      ).trim();

      // Intentional removal: while editing, an intentionally cleared / removed
      // specification (e.g. a custom "Collection Type" / "Fabric" spec removed by
      // the seller) must not block the update from being saved.
      if (!effectiveCollectionType && !dynCollectionAttr && !isEditMode) {
        newErrors.collectionType = 'Collection Type is required.';
      } else if (effectiveCollectionType.length > 100) {
        newErrors.collectionType = 'Collection Type cannot exceed 100 characters.';
      }

      const effectiveFabric = (
        (dynFabricAttr ? String(specValues[dynFabricAttr.id] || '') : '') ||
        formData.fabric.trim() ||
        customSpecs.find((s) => s.name.toLowerCase() === 'fabric')?.value ||
        ''
      ).trim();

      if (!effectiveFabric && !dynFabricAttr && !isEditMode) {
        newErrors.fabric = 'Fabric Type is required (e.g. Lawn, Chiffon, Organza).';
      }
    }

    // Price Validation (Skip when saved variations exist)
    if (!hasSavedVariations) {
      const origPrice = parseFloat(formData.original_retail_price);
      if (!formData.original_retail_price || isNaN(origPrice) || origPrice <= 0) {
        newErrors.original_retail_price = 'Retail Price is required and must be greater than 0.';
      }

      const surplusPrice = parseFloat(formData.surplus_selling_price);
      if (!formData.surplus_selling_price || isNaN(surplusPrice) || surplusPrice <= 0) {
        newErrors.surplus_selling_price = 'Discounted Price is required and must be greater than 0.';
      }
    }

    // Stock Validation
    if (hasSavedVariations) {
      const totalVarQty = variationConfig!.rows.reduce(
        (sum, r) => sum + (r.quantity === '' ? 0 : Number(r.quantity)),
        0
      );
      if (totalVarQty <= 0) {
        newErrors.quantity = 'Total variation quantity must be greater than 0.';
      }
    } else {
      const parsedQty = parseInt(formData.quantity, 10);
      if (!formData.quantity || isNaN(parsedQty) || parsedQty < 0) {
        newErrors.quantity = 'Quantity is required and must be an integer greater than or equal to 0.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Mirrors public.normalize_option_name(text) so rows written from the browser
   * stay consistent with rows written by the create/update RPCs.
   * product_custom_attributes is unique on (product_id, normalized_name).
   */
  const normalizeSpecName = (name: string): string =>
    name.trim().toLowerCase().replace(/\s+/g, ' ');

  // Category that owns this product's attribute values. In edit mode the
  // category is immutable and comes from the loaded product.
  const specificationCategoryId = React.useMemo(
    () => effectiveCategoryId || categoryId || coreQuery.data?.category_id || '',
    [effectiveCategoryId, categoryId, coreQuery.data]
  );

  // O(1) attribute-definition lookup reused for every specification value.
  const attributeDefinitionsMap = React.useMemo(
    () => new Map<string, any>(mergedAttributeDefinitions.map((def) => [def.id, def])),
    [mergedAttributeDefinitions]
  );

  /**
   * Builds the product_custom_attributes rows from the current form state.
   * Rows with an empty name/value are skipped (they are not persisted) and
   * duplicate normalized names are collapsed, since the table is unique on
   * (product_id, normalized_name).
   */
  const buildCustomAttributeRows = (productId: string): CustomAttributeRow[] => {
    const seen = new Set<string>();
    const rows: CustomAttributeRow[] = [];

    for (const spec of customSpecs) {
      const name = (spec.name || '').trim();
      const value = (spec.value || '').trim();
      if (!name || !value) continue;

      const normalizedName = normalizeSpecName(name);
      if (!normalizedName || seen.has(normalizedName)) continue;
      seen.add(normalizedName);

      rows.push({
        product_id: productId,
        name,
        normalized_name: normalizedName,
        value,
        display_order: rows.length,
      });
    }

    return rows;
  };

  /**
   * Builds the product_attribute_values rows from the current form state.
   * Exactly one typed value column is set per row so the
   * product_attribute_one_value_check constraint is always satisfied.
   */
  const buildAttributeValueRows = (productId: string): AttributeValueRow[] => {
    const rows: AttributeValueRow[] = [];

    for (const [attributeId, rawValue] of Object.entries(specValues || {})) {
      const isEmptyValue =
        rawValue === undefined ||
        rawValue === null ||
        (Array.isArray(rawValue) && rawValue.length === 0) ||
        (!Array.isArray(rawValue) && String(rawValue).trim() === '');
      if (isEmptyValue) continue;

      const dataType = String(attributeDefinitionsMap.get(attributeId)?.data_type || '').toLowerCase();
      // Unknown definition (not loaded for this product): nothing to persist against.
      if (!dataType) continue;

      const row: AttributeValueRow = {
        product_id: productId,
        category_id: specificationCategoryId,
        attribute_id: attributeId,
        value_text: null,
        value_number: null,
        value_boolean: null,
        value_jsonb: null,
      };

      if (dataType === 'number') {
        const numericValue = Number(Array.isArray(rawValue) ? rawValue[0] : rawValue);
        if (!Number.isFinite(numericValue)) continue;
        row.value_number = numericValue;
      } else if (dataType === 'boolean') {
        if (typeof rawValue === 'boolean') {
          row.value_boolean = rawValue;
        } else {
          const normalized = String(rawValue).trim().toLowerCase();
          if (normalized !== 'true' && normalized !== 'false') continue;
          row.value_boolean = normalized === 'true';
        }
      } else if (dataType === 'multi_select') {
        const selected = (Array.isArray(rawValue) ? rawValue : [rawValue])
          .map((value) => String(value).trim())
          .filter(Boolean);
        if (selected.length === 0) continue;
        row.value_jsonb = selected;
      } else {
        const text = (
          Array.isArray(rawValue) ? rawValue.map((value) => String(value)).join(', ') : String(rawValue)
        ).trim();
        if (!text) continue;
        row.value_text = text;
      }

      rows.push(row);
    }

    return rows;
  };

  /**
   * Replaces the "Product Specification" rows of an existing product.
   *
   * 1. Builds every replacement row up-front, so a mapping problem can never
   *    happen after the tables have been cleared.
   * 2. Snapshots the current rows for a best-effort rollback.
   * 3. Deletes all product_custom_attributes / product_attribute_values rows
   *    for the product and bulk-inserts the new ones.
   * 4. Returns the freshly generated IDs + typed values for the update RPC and
   *    a rollback used when the product update itself is rejected.
   *
   * Supabase cannot span both tables in a single client transaction, so the
   * deletes run first and any failure restores the snapshot instead of leaving
   * a partially written specification section.
   */
  const persistProductSpecificationChanges = async (
    productId: string
  ): Promise<PersistedSpecificationState> => {
    const customAttributeRows = buildCustomAttributeRows(productId);
    const attributeValueRows = buildAttributeValueRows(productId);

    if (attributeValueRows.length > 0 && !specificationCategoryId) {
      throw new Error('Unable to save Product Specification: the product category is missing.');
    }

    // Snapshot before deleting so a failed write can be reverted.
    const [customSnapshotRes, attributeSnapshotRes] = await Promise.all([
      supabase
        .from('product_custom_attributes')
        .select(CUSTOM_ATTRIBUTE_SNAPSHOT_COLUMNS)
        .eq('product_id', productId),
      supabase
        .from('product_attribute_values')
        .select(ATTRIBUTE_VALUE_SNAPSHOT_COLUMNS)
        .eq('product_id', productId),
    ]);

    if (customSnapshotRes.error) throw customSnapshotRes.error;
    if (attributeSnapshotRes.error) throw attributeSnapshotRes.error;

    const snapshot: SpecificationSnapshot = {
      customAttributes: (customSnapshotRes.data || []) as CustomAttributeRow[],
      attributeValues: (attributeSnapshotRes.data || []) as AttributeValueRow[],
    };
    const cleared = { customAttributes: false, attributeValues: false };

    const rollback = async () => {
      await restoreProductSpecificationRows(productId, snapshot, cleared);
    };

    try {
      // 1. Delete every existing specification row for this product.
      const deleteCustomRes = await supabase
        .from('product_custom_attributes')
        .delete()
        .eq('product_id', productId);
      if (deleteCustomRes.error) throw deleteCustomRes.error;
      cleared.customAttributes = true;

      const deleteAttributesRes = await supabase
        .from('product_attribute_values')
        .delete()
        .eq('product_id', productId);
      if (deleteAttributesRes.error) throw deleteAttributesRes.error;
      cleared.attributeValues = true;

      // 2. Bulk-insert the rows derived from the current form state.
      const [customInsertRes, attributeInsertRes] = await Promise.all([
        customAttributeRows.length > 0
          ? supabase
              .from('product_custom_attributes')
              .insert(customAttributeRows)
              .select('id, normalized_name')
          : Promise.resolve({
              data: [] as Array<{ id: string; normalized_name: string }>,
              error: null,
            }),
        attributeValueRows.length > 0
          ? supabase.from('product_attribute_values').insert(attributeValueRows)
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (customInsertRes.error) throw customInsertRes.error;
      if (attributeInsertRes.error) throw attributeInsertRes.error;

      // 3. Feed the new custom-attribute IDs to the update RPC. They belong to
      //    the product, so the RPC keeps these rows instead of recreating them.
      const insertedCustomRows = (customInsertRes.data || []) as Array<{
        id: string;
        normalized_name: string;
      }>;
      const idByNormalizedName = new Map(
        insertedCustomRows.map((row) => [row.normalized_name, row.id])
      );

      const customSpecsForRpc = customAttributeRows.map((row) => {
        const id = idByNormalizedName.get(row.normalized_name);
        return {
          ...(id ? { id } : {}),
          name: row.name,
          value: row.value,
        };
      });

      // 4. Mirror the inserted rows in the RPC payload, so it does not create
      //    extra rows for values this section intentionally removed.
      const specValuesForRpc: Record<string, any> = {};
      attributeValueRows.forEach((row) => {
        specValuesForRpc[row.attribute_id] =
          row.value_number !== null
            ? row.value_number
            : row.value_boolean !== null
              ? row.value_boolean
              : row.value_jsonb !== null
                ? row.value_jsonb
                : row.value_text;
      });

      return { customSpecs: customSpecsForRpc, specValues: specValuesForRpc, rollback };
    } catch (error: any) {
      try {
        await rollback();
      } catch (restoreError) {
        console.error('Failed to restore Product Specification rows:', restoreError);
      }
      throw new Error(
        `Product Specification could not be saved: ${error?.message || 'unexpected database error'}`
      );
    }
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
      setTimeout(() => {
        const firstErrorEl = document.querySelector('.border-red-500, [aria-invalid="true"]');
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    setIsSubmitting(true);

    const sellerId = user?.id;
    if (!sellerId) {
      setSubmitError('Authentication Error: Seller ID not found. Please log in to your seller account.');
      setIsSubmitting(false);
      return;
    }

    // ========================================================================
    // CREATE MODE: Transactional product creation via createProduct RPC service
    // ========================================================================
    if (!isEditMode) {
      try {
        if (!effectiveCategoryId) {
          throw new Error('Please select a valid Category for your collection.');
        }

        await createProduct({
          userId: sellerId,
          categoryId: effectiveCategoryId,
          title: formData.suit_title,
          description: formData.description,
          defect: formData.defect,
          galleryImages: uploadItems.map((it) => it.file || it.previewUrl || it),
          simple: hasSavedVariations
            ? null
            : {
              sellingPrice: parseFloat(formData.surplus_selling_price),
              compareAtPrice: formData.original_retail_price ? parseFloat(formData.original_retail_price) : null,
              quantity: parseInt(formData.quantity || '1', 10),
            },
          specValues,
          customSpecs,
          variationConfig: hasSavedVariations ? variationConfig : null,
        });

        if (sellerId) {
          queryClient.invalidateQueries({ queryKey: ['seller-products', sellerId] });
          queryClient.invalidateQueries({ queryKey: ['sellerProducts', sellerId] });
        }
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['storefront'] });

        setSubmitSuccess('🎉 Collection created successfully with all details, variants and images!');

        // Reset state for new listing
        clearDraft();
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
        setDepartmentId('');
        setCategory('');
        setCategoryId('');
        setProductType('');
        setSpecValues({});
        setExtraOptions({});
        setCustomSpecs([]);
        setCollectionType('');
        setCustomCollectionTypeInput('');
        setCollectionTypeSearchTerm('');
        setExistingImages([]);
        uploadItemsRef.current.forEach((it) => {
          if (it.previewUrl && it.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(it.previewUrl);
          }
        });
        setUploadItems([]);
        setVariationConfig(null);

        setTimeout(() => {
          router.push('/dashboard/collections');
        }, 1500);

        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 500);
        }
        return;
      } catch (err: any) {
        console.error('Product creation error:', err);
        setSubmitError(err?.message || 'Failed to create collection listing. Please try again.');
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    // ========================================================================
    // EDIT MODE: Transactional product update via updateProduct RPC service
    // ========================================================================
    if (isEditMode && targetEditId) {
      // No-change guard: skip all network calls (Section 5)
      if (patchResult.isEmpty) {
        setSubmitSuccess('No changes to save.');
        setIsSubmitting(false);
        setTimeout(() => setSubmitSuccess(null), 2500);
        return;
      }

      // Check for destructive changes (deactivated variants or zeroed stock)
      if (patchResult.dirtySections.has('variations') && patchResult.patch?.variations) {
        const v = patchResult.patch.variations;
        const hasDestructive = (v.deactivatedVariantIds && v.deactivatedVariantIds.length > 0) ||
          (v.variantChanges || []).some((vc) => vc.quantity && vc.quantity.to === 0 && vc.quantity.from > 0);
        if (hasDestructive) {
          const proceed = window.confirm(
            'Notice: This update modifies stock levels or removes existing variation combinations. Do you want to proceed and save these changes?'
          );
          if (!proceed) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Product Specification change detection: only a real update that touched
      // the specification section replaces the persisted rows. Create mode and
      // unchanged specifications never touch these tables.
      const specDirty =
        patchResult.dirtySections.has('customSpecs') || patchResult.dirtySections.has('attributeValues');

      // Status as loaded for this edit session; sold-out listings go back on sale once saved
      const wasSoldOut = (coreQuery.data?.status || '').toLowerCase().trim() === 'sold_out';

      // Only IDs that existed when the edit snapshot was loaded are real database rows.
      // Specs added in this session carry client-side IDs and must be inserted without an
      // id, otherwise the update RPC rejects them with "does not belong to this product".
      const persistedCustomSpecIds = new Set(
        ((baselineSnapshot?.customSpecs || []) as Array<{ id: string }>).map((spec) => spec.id)
      );
      const customSpecsForUpdate = customSpecs.map((spec) => ({
        name: spec.name,
        value: spec.value,
        ...(persistedCustomSpecIds.has(spec.id) ? { id: spec.id } : {}),
      }));

      // Tracks a committed specification replacement so it can be reverted when
      // the product update itself is rejected (e.g. optimistic-concurrency CONFLICT).
      let specificationState: PersistedSpecificationState | null = null;
      let productUpdateCommitted = false;

      try {
        if (specDirty) {
          // Delete all existing specification rows for this product, then bulk-insert
          // the rows derived from the current form state. Any failure is rolled back
          // to the pre-save snapshot and surfaced through the catch below.
          specificationState = await persistProductSpecificationChanges(targetEditId);
        }

        await updateProduct({
          productId: targetEditId,
          sellerId,
          expectedUpdatedAt: expectedUpdatedAt || undefined,
          categoryId: categoryId || undefined,
          title: formData.suit_title,
          description: formData.description,
          defect: formData.defect,
          galleryImages: [...existingImages, ...uploadItems.map((it) => it.file || it)],
          simple: hasSavedVariations
            ? null
            : {
              sellingPrice: parseFloat(formData.surplus_selling_price),
              compareAtPrice: formData.original_retail_price ? parseFloat(formData.original_retail_price) : null,
              quantity: parseInt(formData.quantity || '0', 10),
            },
          // After a specification replacement, send the rows that are now persisted
          // (with their new IDs) so the RPC keeps them instead of recreating them.
          specValues: specificationState ? specificationState.specValues : specValues,
          customSpecs: specificationState ? specificationState.customSpecs : customSpecsForUpdate,
          variationConfig: hasSavedVariations ? variationConfig : null,
          optionImagesLoaded: false,
          confirmDestructive: true,
          patch: patchResult.patch,
        });
        productUpdateCommitted = true;

        // Runs only after the update RPC committed, so the activation check sees the new stock
        let reactivationError: unknown = null;
        if (wasSoldOut) {
          try {
            await setProductStatus(targetEditId, sellerId, 'active');
          } catch (statusErr) {
            reactivationError = statusErr;
          }
        }

        // Post-update invalidation (Section 3)
        if (sellerId) {
          queryClient.invalidateQueries({ queryKey: ['seller-products', sellerId] });
          queryClient.invalidateQueries({ queryKey: ['sellerProducts', sellerId] });
        }
        queryClient.removeQueries({ queryKey: productEditKeys.all(sellerId, targetEditId) });
        queryClient.invalidateQueries({ queryKey: ['product-information', sellerId, targetEditId] });
        queryClient.invalidateQueries({ queryKey: ['product', targetEditId] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['storefront'] });

        if (reactivationError) {
          console.error('Product reactivation error:', reactivationError);
          setSubmitError(
            `Your changes were saved, but the listing is still marked Sold Out: ${mapStatusUpdateError(reactivationError)} Click "Return to Listings" and re-open this product to try again.`
          );
          return;
        }

        setSubmitSuccess(
          isRestockMode ? '🎉 Collection restocked successfully!' : '🎉 Collection updated successfully!'
        );

        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            router.push('/dashboard/collections');
          }
        }, 1200);
        return;
      } catch (err: any) {
        console.error('Product update error:', err);

        // The product update was rejected after the specification rows were already
        // replaced: put the previous specification rows back so the save is all-or-nothing.
        if (specificationState && !productUpdateCommitted) {
          try {
            await specificationState.rollback();
          } catch (rollbackErr) {
            console.error('Product Specification rollback error:', rollbackErr);
          }
        }

        const errMsg = String(err?.message || '');
        // Handle CONFLICT errors with Reload guidance
        if (errMsg.includes('CONFLICT:')) {
          setSubmitError(
            `${errMsg} Click "Return to Listings" and re-open this product to reload the latest data.`
          );
        } else {
          setSubmitError(parseSupabaseError(err));
        }
        return;
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const getButtonText = () => {
    if (isSubmitting) {
      return isRestockMode ? 'Restocking Collection...' : isEditMode ? 'Saving Changes...' : 'Creating Collection...';
    }
    if (isAnySectionLoading) {
      return 'Loading Product Details...';
    }
    if (isAnySectionError) {
      return 'Error Loading Product';
    }
    if (isEditMode && !isFormDirty) {
      return 'No Changes';
    }
    return isRestockMode ? 'Restock Collection' : isEditMode ? 'Save Changes' : 'Add Product';
  };

  if (isEditMode && productNotFound) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-500">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-stone-900">Product Not Found</h2>
        <p className="text-xs text-stone-500">
          The requested product does not exist, has been removed, or does not belong to your seller account.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard/collections"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Return to Listings
          </Link>
        </div>
      </div>
    );
  }

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

      {/* Edit Mode Header only (Tagline 'Add New Collection Listing' is removed) */}
      {isEditMode && (
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 gap-3">
          <h2 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight flex items-center space-x-2">
            {isRestockMode ? (
              <RefreshCw className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <Package className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <span>{isRestockMode ? 'Restock Collection Listing' : 'Edit Collection Listing'}</span>
          </h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-md border border-stone-300 transition-colors cursor-pointer shrink-0"
            >
              Cancel Edit
            </button>
          )}
        </div>
      )}

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
        {/* CONTAINER 1: Collection Photography Gallery */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-stone-200 shadow-xs space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-200 pb-2 gap-2">
            <div>
              <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs sm:text-sm flex items-center space-x-2">
                {/* <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" /> */}
                <span>Collection Images <span className="text-red-600">*</span></span>
              </h3>




            </div>
          </div>

          {/* Core Details / Images Loading Skeleton */}
          {isCoreLoading && (
            <div className="flex flex-nowrap overflow-x-auto gap-3 sm:gap-4 pt-1 pb-2 w-full items-stretch min-w-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-36 sm:w-44 shrink-0 aspect-3/4 rounded-md bg-stone-100 border border-stone-200 animate-pulse flex flex-col items-center justify-center text-stone-300"
                >
                  <ImageIcon className="w-6 h-6 mb-1 text-stone-300" />
                  <span className="text-[10px] font-semibold text-stone-400">Loading images...</span>
                </div>
              ))}
            </div>
          )}

          {/* Core Details / Images Error State */}
          {isCoreError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700 font-medium">
              <span>Failed to load product details and images: {coreQuery.error?.message || 'Unknown error'}</span>
              <button
                type="button"
                onClick={() => retrySectionLoad('core')}
                className="flex items-center space-x-1 font-bold text-red-800 hover:text-red-950 underline cursor-pointer shrink-0 ml-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!isCoreLoading && !isCoreError && (
            <>
              {/* Initial Drag-and-Drop Area (Shown ONLY when NO images have been uploaded yet) */}
              {totalImageCount === 0 && (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files) {
                      processImageFiles(Array.from(e.dataTransfer.files));
                    }
                  }}
                  className="border-2 border-dashed border-stone-300 hover:border-stone-800 bg-white hover:bg-stone-50 transition-colors rounded-lg p-5 sm:p-8 flex flex-col items-center justify-center cursor-pointer text-center shadow-2xs group"
                >
                  <div className="w-10 h-10 rounded-full bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center mb-2 transition-colors">
                    <Upload className="w-5 h-5 text-stone-600" />
                  </div>
                  <span className="font-bold text-stone-800 text-xs sm:text-sm uppercase tracking-wide mb-1">
                    Click to browse or drag collection images
                  </span>
                  <span className="text-[11px] sm:text-xs text-stone-500 max-w-md">
                    Supports JPG, PNG, WEBP
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
                <div className="flex flex-nowrap overflow-x-auto gap-3 sm:gap-4 pt-1 pb-2 no-scrollbar sm:scrollbar-thin sm:scrollbar-thumb-stone-300 w-full items-stretch min-w-0">
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
                                : 'Ready'}
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

                  {/* Inline Add Photo Card (Visible when at least 1 image uploaded and total < 10) */}
                  {totalImageCount < MAX_PRODUCT_IMAGES && (
                    <label
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files) {
                          processImageFiles(Array.from(e.dataTransfer.files));
                        }
                      }}
                      className="w-36 sm:w-44 shrink-0 aspect-3/4 border-2 border-dashed border-stone-300 hover:border-stone-800 bg-white hover:bg-stone-50 transition-colors rounded-md flex flex-col items-center justify-center cursor-pointer text-center p-3 shadow-2xs group"
                    >
                      <div className="w-9 h-9 rounded-full bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center mb-1.5 transition-colors">
                        <Plus className="w-5 h-5 text-stone-600" />
                      </div>
                      <span className="font-bold text-stone-800 text-[11px] sm:text-xs uppercase tracking-wide">
                        Add Photo
                      </span>
                      <span className="text-[10px] text-stone-500 mt-0.5 font-medium">
                        ({totalImageCount}/{MAX_PRODUCT_IMAGES})
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
            </>
          )}
        </div>

        {/* CONTAINER 2: Product Specification */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-stone-200 shadow-xs space-y-4 min-w-0">
          <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs sm:text-sm border-b border-stone-200 pb-2 flex items-center space-x-2">
            <span>Product Specification</span>
          </h3>

          {/* Row 1: Product Title, Department, Category */}
          {isCoreLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 min-w-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="min-w-0 animate-pulse">
                  <div className="h-3.5 bg-stone-200 rounded w-24 mb-1.5" />
                  <div className="h-[42px] bg-stone-100 border border-stone-200 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 min-w-0">
              {/* Product Title */}
              <div className="min-w-0">
                <label htmlFor="field-product-title" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                  Product Title <span className="text-red-600">*</span>
                </label>
                <input
                  id="field-product-title"
                  type="text"
                  placeholder="Embroidered 3PC Lawn Suit"
                  value={formData.suit_title}
                  onChange={(e) => handleInputChange('suit_title', e.target.value)}
                  className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold ${errors.suit_title ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                    }`}
                />
                {errors.suit_title && <p className="text-xs text-red-600 font-medium mt-1">{errors.suit_title}</p>}
              </div>

              {/* Department */}
              <div className="min-w-0">
                {isEditMode ? (
                  <>
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                      Department
                    </label>
                    <div
                      className="w-full p-3 border border-stone-200 rounded-lg bg-stone-50 min-h-[42px] text-xs sm:text-sm font-semibold text-stone-700 cursor-not-allowed"
                      aria-readonly="true"
                      title="Department and category can't be changed after the product is created"
                    >
                      {department || 'Not set'}
                    </div>
                  </>
                ) : (
                  <SearchableSelect
                    id="field-department"
                    label="Department"
                    required
                    multiple={false}
                    value={effectiveDepartmentId}
                    options={departmentOptions}
                    placeholder={isDepartmentsLoading ? 'Loading departments...' : 'Select Department'}
                    disabled={isDepartmentsLoading}
                    isLoading={isDepartmentsLoading}
                    isError={isDepartmentsError}
                    errorMessage="Failed to load departments"
                    onRetry={() => refetchDepartments()}
                    emptyMessage="No departments available"
                    allowCustomAdd={false}
                    error={errors.department}
                    onChange={(val, opt) => handleDepartmentChange(val, opt?.label)}
                  />
                )}
              </div>

              {/* Category */}
              <div className="min-w-0">
                {isEditMode ? (
                  <>
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                      Category
                    </label>
                    <div
                      className="w-full p-3 border border-stone-200 rounded-lg bg-stone-50 min-h-[42px] text-xs sm:text-sm font-semibold text-stone-700 cursor-not-allowed"
                      aria-readonly="true"
                      title="Department and category can't be changed after the product is created"
                    >
                      {category || 'Not set'}
                    </div>
                  </>
                ) : (
                  <SearchableSelect
                    id="field-category"
                    label="Category"
                    required
                    multiple={false}
                    value={effectiveCategoryId}
                    options={categoryOptions}
                    placeholder={
                      !effectiveDepartmentId
                        ? 'Select Department first'
                        : isCategoriesLoading
                          ? 'Loading categories...'
                          : 'Select Category'
                    }
                    disabled={!effectiveDepartmentId || isCategoriesLoading}
                    isLoading={isCategoriesLoading}
                    isError={isCategoriesError}
                    errorMessage="Failed to load categories"
                    onRetry={() => refetchCategories()}
                    emptyMessage={
                      !effectiveDepartmentId
                        ? 'Select Department first'
                        : 'No categories in this department'
                    }
                    allowCustomAdd={false}
                    error={errors.category}
                    onChange={(val, opt) => handleCategoryChange(val, opt?.label)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Specification Grid (Rows 2+): one grid, grid-cols-1 md:grid-cols-3, same gap, field height, and width */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 min-w-0 items-end">
            {/* Dynamic Category Specifications Loading Skeleton (3 pulsing cards matching field dimensions) */}
            {((effectiveCategoryId && isCategoryDefsLoading) || isAttributesLoading) && (
              <>
                <div className="min-w-0 animate-pulse">
                  <div className="h-3.5 bg-stone-200 rounded w-24 mb-1.5" />
                  <div className="h-[42px] bg-stone-100 border border-stone-200 rounded-lg" />
                </div>
                <div className="min-w-0 animate-pulse">
                  <div className="h-3.5 bg-stone-200 rounded w-28 mb-1.5" />
                  <div className="h-[42px] bg-stone-100 border border-stone-200 rounded-lg" />
                </div>
                <div className="min-w-0 animate-pulse">
                  <div className="h-3.5 bg-stone-200 rounded w-20 mb-1.5" />
                  <div className="h-[42px] bg-stone-100 border border-stone-200 rounded-lg" />
                </div>
              </>
            )}

            {/* Dynamic Category Specifications Error State */}
            {((effectiveCategoryId && isCategoryDefsError) || isAttributesError) && !isAttributesLoading && (
              <div className="col-span-full p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700 font-medium">
                <span>Failed to load specifications for {category || 'this category'}.</span>
                <button
                  type="button"
                  onClick={() => {
                    if (isAttributesError) retrySectionLoad('attributes');
                    if (isCategoryDefsError) refetchCategoryDefs();
                  }}
                  className="flex items-center space-x-1 font-bold text-red-800 hover:text-red-950 underline cursor-pointer shrink-0 ml-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* Dynamic Category Specifications Fields in sort_order */}
            {!isAttributesLoading &&
              !isCategoryDefsLoading &&
              !isAttributesError &&
              !isCategoryDefsError &&
              mergedAttributeDefinitions.map((attr) => (
                <DynamicAttributeField
                  key={attr.id}
                  attribute={attr}
                  value={specValues[attr.id]}
                  extraOptions={extraOptions[attr.id] || []}
                  onChange={(val) => handleSpecValueChange(attr.id, attr.name, val)}
                  onAddExtraOption={(newOpt) => handleAddExtraOption(attr.id, newOpt)}
                  error={errors[`attr_${attr.id}`]}
                />
              ))}

            {/* Custom Specifications in insertion order (editable inline with remove control) */}
            {customSpecs.map((spec) => (
              <div key={spec.id} className="min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-stone-900 uppercase tracking-wide text-xs truncate" title={spec.name}>
                    {spec.name}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomSpec(spec.id)}
                    className="p-0.5 text-stone-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                    aria-label={`Remove specification ${spec.name}`}
                    title="Remove specification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={spec.value}
                  onChange={(e) => handleUpdateCustomSpecValue(spec.id, e.target.value)}
                  className="w-full p-3 border border-stone-300 focus:border-stone-900 rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold bg-white"
                  placeholder={`Enter ${spec.name}`}
                />
              </div>
            ))}

            {/* Add Specification Button: Always the LAST cell */}
            <div className="min-w-0 flex flex-col justify-end">
              <button
                ref={addSpecBtnRef}
                type="button"
                onClick={() => setIsSpecModalOpen(true)}
                className="w-full min-h-[42px] px-4 py-2.5 border border-dashed border-stone-300 hover:border-stone-800 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4 text-stone-500" />
                <span>Add Specification</span>
              </button>
            </div>
          </div>

          {/* Edit Mode extra fields if editing existing listing */}
          {isEditMode && (
            <div className="pt-4 border-t border-stone-100 space-y-4">
              <div className={`grid grid-cols-1 ${isClothing ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 sm:gap-5`}>
                {/* Brand */}
                {/* <div className="min-w-0 relative" ref={brandDropdownRef}>
                  <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                    Brand <span className="text-red-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsBrandDropdownOpen((prev) => !prev)}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none bg-white min-h-[42px] flex items-center justify-between text-left transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-semibold truncate text-stone-900">
                      {formData.brand || 'Select Brand'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-stone-400" />
                  </button>
                </div> */}

                {/* Collection Type for Clothing */}
                {isClothing && (
                  <div className="min-w-0 relative" ref={collectionTypeDropdownRef}>
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                      Collection Type <span className="text-red-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCollectionTypeDropdownOpen((prev) => !prev)}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none bg-white min-h-[42px] flex items-center justify-between text-left transition-colors"
                    >
                      <span className="text-xs sm:text-sm font-semibold truncate text-stone-900">
                        {collectionType || 'Select Collection Type'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-stone-400" />
                    </button>
                  </div>
                )}

                {/* Fabric Type for Clothing */}
                {isClothing && (
                  <div className="min-w-0">
                    <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                      Fabric Type <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Lawn, Chiffon, etc."
                      value={formData.fabric}
                      onChange={(e) => handleInputChange('fabric', e.target.value)}
                      className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CONTAINER 3: Stock */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-stone-200 shadow-xs space-y-4 min-w-0">
          <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs sm:text-sm border-b border-stone-200 pb-2 flex items-center space-x-2">
            <span>Stock</span>
          </h3>

          {/* Generic Stock Skeleton while Core Product Details are Loading */}
          {isCoreLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 min-w-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="min-w-0 animate-pulse">
                  <div className="h-3.5 bg-stone-200 rounded w-24 mb-1.5" />
                  <div className="h-[42px] bg-stone-100 border border-stone-200 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Row 1: Variation label on left, Add/Edit on right */}
              <div className="flex flex-nowrap items-center justify-between gap-3 pb-2 border-b border-stone-100 min-w-0">
                <div className="min-w-0 truncate">
                  <span className="font-bold text-stone-900 uppercase tracking-wide text-xs sm:text-sm block truncate">
                    Variation
                  </span>
                  <p className="text-2xs sm:text-xs text-stone-500 mt-0.5 truncate">
                    Configure variations and manage stock by option.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!isCoreLoaded || isVariationsLoading || isVariationsError}
                  onClick={() => {
                    if (isEditMode && targetEditId) {
                      router.push(`/dashboard/productVarition?productId=${encodeURIComponent(targetEditId)}`);
                    } else {
                      router.push('/dashboard/productVarition');
                    }
                  }}
                  className="shrink-0 whitespace-nowrap px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold rounded-lg bg-stone-900 hover:bg-black text-white transition-all cursor-pointer shadow-xs disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed"
                >
                  {hasSavedVariations ? 'Edit' : 'Add'}
                </button>
              </div>

              {/* Variations Section Loading Skeleton */}
              {isVariationsLoading && (
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg animate-pulse space-y-3">
                  <div className="flex items-center space-x-2 text-stone-600 text-xs font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin text-stone-800" />
                    <span>Loading variation combinations...</span>
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="h-8 bg-stone-200/70 rounded" />
                    <div className="h-8 bg-stone-200/70 rounded" />
                  </div>
                </div>
              )}

              {/* Variations Section Error State */}
              {isVariationsError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700 font-medium">
                  <span>Failed to load variation combinations: {editSections.variations.error}</span>
                  <button
                    type="button"
                    onClick={() => retrySectionLoad('variations')}
                    className="flex items-center space-x-1 font-bold text-red-800 hover:text-red-950 underline cursor-pointer shrink-0 ml-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              {/* Summary line with Remove button (only allowed in create mode) */}
              {!isVariationsLoading && !isVariationsError && hasSavedVariations && (
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex flex-wrap items-center justify-between gap-2.5 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-bold text-stone-900 text-xs shrink-0">Summary:</span>
                    <span className="font-semibold text-stone-800 text-xs break-words">
                      {variationSummaryText || 'Variations configured'}
                    </span>
                  </div>
                  {!isEditMode && (
                    <button
                      type="button"
                      onClick={handleRemoveVariations}
                      className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-all cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}

              {/* Compact read-only preview of saved combinations */}
              {!isVariationsLoading && !isVariationsError && hasSavedVariations && variationConfig && variationConfig.rows.length > 0 && (
                <div className="rounded-lg border border-stone-200 overflow-hidden bg-white shadow-2xs min-w-0">
                  <div className="px-3 py-2 bg-stone-100/70 border-b border-stone-200 text-xs font-semibold text-stone-700">
                    Saved Combinations ({variationConfig.rows.length})
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-stone-50 sticky top-0 z-10 border-b border-stone-200 text-stone-600 font-semibold uppercase text-3xs tracking-wider">
                        <tr>
                          {variationConfig.dimensions && variationConfig.dimensions.length > 0 ? (
                            variationConfig.dimensions
                              .filter((d) => d.enabled && d.values.length > 0)
                              .map((d) => (
                                <th key={d.id} className="p-2.5">
                                  {d.name}
                                </th>
                              ))
                          ) : (
                            <>
                              {variationConfig.useColor && <th className="p-2.5">Color</th>}
                              {variationConfig.useSize && <th className="p-2.5">Size</th>}
                            </>
                          )}
                          <th className="p-2.5">Price</th>
                          <th className="p-2.5 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-stone-800">
                        {variationConfig.rows.map((row) => (
                          <tr key={row.key} className="hover:bg-stone-50/60">
                            {variationConfig.dimensions && variationConfig.dimensions.length > 0 ? (
                              variationConfig.dimensions
                                .filter((d) => d.enabled && d.values.length > 0)
                                .map((d) => {
                                  const val =
                                    row.attributes?.[d.name] ??
                                    (row as any).values?.[d.name] ??
                                    (row as any).values?.[d.id] ??
                                    (d.name.toLowerCase() === 'color' ? row.color : d.name.toLowerCase() === 'size' ? row.size : '') ??
                                    '';
                                  const imgEntry = val && variationConfig.valueImages
                                    ? variationConfig.valueImages[normalizeVariationValueKey(d.name, val)]
                                    : null;
                                  return (
                                    <td key={d.id} className="p-2.5 font-medium">
                                      <div className="flex items-center space-x-1.5">
                                        {imgEntry?.file ? (
                                          <ValueThumbnail file={imgEntry.file} alt={val} />
                                        ) : (imgEntry?.previewUrl || imgEntry?.imageUrl) ? (
                                          <img
                                            src={imgEntry.previewUrl || imgEntry.imageUrl}
                                            alt={val}
                                            className="w-5 h-5 object-cover rounded border border-stone-200 shrink-0 inline-block mr-1.5 align-middle"
                                          />
                                        ) : null}
                                        <span>{val || '—'}</span>
                                      </div>
                                    </td>
                                  );
                                })
                            ) : (
                              <>
                                {variationConfig.useColor && (
                                  <td className="p-2.5 font-medium">
                                    <div className="flex items-center space-x-1.5">
                                      {row.color && variationConfig.valueImages?.[normalizeVariationValueKey('Color', row.color)]?.file && (
                                        <ValueThumbnail
                                          file={variationConfig.valueImages[normalizeVariationValueKey('Color', row.color)].file!}
                                          alt={row.color}
                                        />
                                      )}
                                      <span>{row.color || '—'}</span>
                                    </div>
                                  </td>
                                )}
                                {variationConfig.useSize && (
                                  <td className="p-2.5 font-medium">
                                    <div className="flex items-center space-x-1.5">
                                      {row.size && variationConfig.valueImages?.[normalizeVariationValueKey('Size', row.size)]?.file && (
                                        <ValueThumbnail
                                          file={variationConfig.valueImages[normalizeVariationValueKey('Size', row.size)].file!}
                                          alt={row.size}
                                        />
                                      )}
                                      <span>{row.size || '—'}</span>
                                    </div>
                                  </td>
                                )}
                              </>
                            )}
                            <td className="p-2.5 font-semibold text-stone-900">
                              Rs {row.price !== '' ? Number(row.price).toFixed(2) : '0.00'}
                            </td>
                            <td className="p-2.5 text-right font-medium text-stone-700">
                              {row.quantity !== '' ? row.quantity : 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Row 2: Compare Price, Selling Price, Quantity (rendered when simple product) */}
              {!isVariationsLoading && !isVariationsError && !hasSavedVariations && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 min-w-0">
                  {/* Compare Price */}
                  <div className="min-w-0">
                    <label htmlFor="field-compare-price" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                      Compare Price <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-stone-400 font-bold text-xs">Rs</span>
                      <input
                        id="field-compare-price"
                        type="number"
                        min="1"
                        placeholder="6500"
                        value={formData.original_retail_price}
                        onChange={(e) => handleInputChange('original_retail_price', e.target.value)}
                        className={`w-full p-3 pl-10 border rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold ${errors.original_retail_price ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                          }`}
                      />
                    </div>
                    {errors.original_retail_price && (
                      <p className="text-xs text-red-600 font-medium mt-1">{errors.original_retail_price}</p>
                    )}
                  </div>

                  {/* Selling Price */}
                  <div className="min-w-0">
                    <label htmlFor="field-selling-price" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                      Selling Price <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-stone-400 font-bold text-xs">Rs</span>
                      <input
                        id="field-selling-price"
                        type="number"
                        min="1"
                        placeholder="3500"
                        value={formData.surplus_selling_price}
                        onChange={(e) => handleInputChange('surplus_selling_price', e.target.value)}
                        className={`w-full p-3 pl-10 border rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold ${errors.surplus_selling_price ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                          }`}
                      />
                    </div>
                    {errors.surplus_selling_price && (
                      <p className="text-xs text-red-600 font-medium mt-1">{errors.surplus_selling_price}</p>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="min-w-0">
                    <label htmlFor="field-quantity" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                      Quantity <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="field-quantity"
                      type="number"
                      min="0"
                      placeholder="1"
                      value={formData.quantity}
                      onChange={(e) => handleInputChange('quantity', e.target.value)}
                      className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] text-xs sm:text-sm font-semibold ${errors.quantity ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                        }`}
                    />
                    {errors.quantity && <p className="text-xs text-red-600 font-medium mt-1">{errors.quantity}</p>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* CONTAINER 4: Description */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-stone-200 shadow-xs space-y-4 min-w-0">
          <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs sm:text-sm border-b border-stone-200 pb-2 flex items-center space-x-2">
            <span>Description</span>
          </h3>

          {/* Description Section Loading Skeleton */}
          {isCoreLoading ? (
            <div className="space-y-4 animate-pulse">
              <div>
                <div className="h-3.5 bg-stone-200 rounded w-32 mb-1.5" />
                <div className="h-[42px] bg-stone-100 border border-stone-200 rounded-lg" />
              </div>
              <div>
                <div className="h-3.5 bg-stone-200 rounded w-48 mb-1.5" />
                <div className="h-28 bg-stone-100 border border-stone-200 rounded-lg" />
              </div>
            </div>
          ) : (
            <>
              {/* Defect Disclaimer Dropdown */}
              <div className="relative min-w-0" ref={defectDropdownRef}>
                <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs">
                  Defect / Flaw Disclaimer
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsDefectDropdownOpen((prev) => !prev);
                    setIsBrandDropdownOpen(false);
                    setIsCollectionTypeDropdownOpen(false);
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
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-between cursor-pointer ${isSelected ? 'bg-stone-900 text-white font-bold' : 'text-stone-800 hover:bg-stone-100 hover:text-stone-900'
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
              <div className="min-w-0">
                <label htmlFor="field-description" className="font-bold text-stone-900 block mb-1 uppercase tracking-wide text-xs flex items-center space-x-1">
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
            </>
          )}
        </div>

        {/* 5. Add/Update Product button, below all containers */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || isAnySectionLoading || isAnySectionError || (isEditMode && !isFormDirty)}
            className="w-full py-3.5 sm:py-4 bg-stone-900 hover:bg-black disabled:bg-stone-300 disabled:text-stone-500 text-white text-xs sm:text-sm font-bold uppercase tracking-widest rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSubmitting || isAnySectionLoading ? (
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

      {/* Add Specification Modal */}
      <AddSpecificationModal
        isOpen={isSpecModalOpen}
        onClose={() => setIsSpecModalOpen(false)}
        onAdd={handleAddCustomSpec}
        existingSpecs={[
          ...customSpecs,
          ...mergedAttributeDefinitions.map((attr) => ({ id: attr.id, name: attr.name, value: '' })),
        ]}
        triggerButtonRef={addSpecBtnRef}
      />
    </div>
  );
};

export const NewListingForm: React.FC<NewListingFormProps> = ({
  editingListing = null,
  productId: propProductId,
  mode = 'create',
  newListing,
  setNewListing,
  handleCreateListing,
  onSuccess,
  onCancel,
}) => {
  const searchParams = useSearchParams();
  const urlProductId = searchParams ? (searchParams.get('productId') || searchParams.get('id')) : null;
  const effectiveProductId = propProductId || urlProductId || editingListing?.id || null;
  const isEditMode = mode === 'edit' || mode === 'restock' || Boolean(editingListing) || Boolean(effectiveProductId);

  // In edit mode with an ID, validate UUID format: malformed ID must NEVER fall back to create mode!
  if (isEditMode && effectiveProductId && !isValidUuid(effectiveProductId)) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-500">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-stone-900">Product Not Found</h2>
        <p className="text-xs text-stone-500">
          The product ID provided in the URL is invalid or malformed.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard/collections"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Return to Listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <NewListingFormContent
      key="listing-form"
      productId={effectiveProductId}
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
