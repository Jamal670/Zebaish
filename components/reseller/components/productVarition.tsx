'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '@/src/api/client';
import {
  Plus,
  X,
  ArrowLeft,
  Check,
  AlertCircle,
  Trash2,
  Tag,
  Upload,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import {
  useListingDraft,
  VariationConfig,
  VariationDimension,
  VariationRow,
  getPriceRange,
  formatPriceRange,
  normalizeVariationValueKey,
} from '../context/ListingDraftContext';
import { useObjectUrl } from '@/src/hooks/useObjectUrl';

const MAX_VALUES_PER_DIMENSION = 20;
const MAX_TOTAL_COMBINATIONS = 100;

function cartesianProduct(dims: VariationDimension[]): Record<string, string>[] {
  const enabled = dims.filter((d) => d.enabled && d.values.length > 0);
  if (enabled.length === 0) return [];

  return enabled.reduce<Record<string, string>[]>((acc, dim) => {
    if (acc.length === 0) {
      return dim.values.map((v) => ({ [dim.name]: v }));
    }
    const next: Record<string, string>[] = [];
    for (const prev of acc) {
      for (const val of dim.values) {
        next.push({ ...prev, [dim.name]: val });
      }
    }
    return next;
  }, []);
}

function GalleryItemThumbnail({
  file,
  isSelected,
  onSelect,
}: {
  file: File;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const url = useObjectUrl(file);
  if (!url) return null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-12 h-12 rounded-md overflow-hidden border transition-all cursor-pointer ${
        isSelected
          ? 'border-stone-900 ring-2 ring-stone-900 shadow-xs'
          : 'border-stone-200 hover:border-stone-700 opacity-70 hover:opacity-100'
      }`}
      title="Use this photo from gallery"
    >
      <img src={url} alt="Gallery item" className="w-full h-full object-cover" />
    </button>
  );
}

function CombinationRowThumbnail({ file, url, alt }: { file?: File | null; url?: string | null; alt: string }) {
  const objectUrl = useObjectUrl(file);
  const displayUrl = objectUrl || url;
  if (displayUrl) {
    return (
      <div className="w-10 h-10 shrink-0">
        <img
          src={displayUrl}
          alt={alt}
          className="w-10 h-10 object-cover rounded-md border border-stone-200 shadow-2xs"
        />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-md border border-dashed border-stone-200 bg-stone-50/50 flex items-center justify-center text-stone-300">
      <ImageIcon className="w-4 h-4" />
    </div>
  );
}

export const ProductVarition: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    variationConfig,
    setVariationConfig,
    uploadItems,
    existingImages: galleryExistingImages,
    editProductId,
    editSections,
    setSectionState,
    isSectionInitialized,
  } = useListingDraft();

  const urlProductId = searchParams?.get('productId') || searchParams?.get('id');
  const targetProductId = urlProductId || editProductId || null;
  const isEditMode = Boolean(targetProductId);
  const returnUrl = isEditMode && targetProductId
    ? `/dashboard/add-collection?productId=${targetProductId}`
    : '/dashboard/add-collection';

  // The variation editor only works on top of an already-initialized edit draft.
  // Checking the initialized section keeps normal navigation open while still
  // redirecting on a hard refresh / direct visit where no draft exists.
  const isCoreDraftReady = Boolean(
    targetProductId && isSectionInitialized('core', targetProductId)
  );

  useEffect(() => {
    if (isEditMode && targetProductId && !isCoreDraftReady) {
      router.replace(returnUrl);
    }
  }, [isEditMode, targetProductId, isCoreDraftReady, returnUrl, router]);

  // Distinct gallery image items that carry a File
  const galleryItemsWithFile = useMemo(() => {
    const list: { file: File; id: string }[] = [];
    const seenFiles = new Set<File>();

    (uploadItems || []).forEach((item: any, idx: number) => {
      if (item?.file instanceof File && !seenFiles.has(item.file)) {
        seenFiles.add(item.file);
        list.push({ file: item.file, id: item.id || `gallery_${idx}` });
      }
    });

    return list;
  }, [uploadItems]);

  // Dynamic dimensions initialization
  const [dimensions, setDimensions] = useState<VariationDimension[]>(() => {
    if (variationConfig?.dimensions && variationConfig.dimensions.length > 0) {
      return variationConfig.dimensions;
    }
    // Backward compatibility: migrate legacy useColor/useSize
    const legacy: VariationDimension[] = [];
    if (variationConfig?.colors && variationConfig.colors.length > 0) {
      legacy.push({
        id: 'dim_color',
        name: 'Color',
        enabled: variationConfig.useColor ?? true,
        values: variationConfig.colors,
      });
    }
    if (variationConfig?.sizes && variationConfig.sizes.length > 0) {
      legacy.push({
        id: 'dim_size',
        name: 'Size',
        enabled: variationConfig.useSize ?? false,
        values: variationConfig.sizes,
      });
    }
    return legacy;
  });

  // State for adding a new dimension dynamically
  const [newDimensionName, setNewDimensionName] = useState('');
  const [dimensionError, setDimensionError] = useState<string | null>(null);

  // Per-dimension value input & error state
  const [valueInputs, setValueInputs] = useState<Record<string, string>>({});
  const [valueErrors, setValueErrors] = useState<Record<string, string | null>>({});

  // Variation-based Image Management states
  const [imageDimension, setImageDimension] = useState<string>(
    variationConfig?.imageDimension ?? ''
  );

  // Working copy of value images initialized from saved variationConfig.valueImages
  // (Preloads existing images on reopen, keeping File and URL references intact)
  const [valueImages, setValueImages] = useState<
    Record<
      string,
      {
        file?: File;
        storagePath?: string;
        imageUrl?: string;
        previewUrl?: string;
        id?: string;
      }
    >
  >(() => {
    if (variationConfig?.valueImages) {
      return { ...variationConfig.valueImages };
    }
    return {};
  });

  const [activeImageValue, setActiveImageValue] = useState<string>('');
  const [imageWarning, setImageWarning] = useState<string | null>(null);

  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [optionImagesReloadToken, setOptionImagesReloadToken] = useState(0);

  // Active value image file & its managed preview URL (scoped strictly to this component)
  const activeImageFile = useMemo(() => {
    if (!imageDimension || !activeImageValue) return null;
    const key = normalizeVariationValueKey(imageDimension, activeImageValue);
    return valueImages[key]?.file || null;
  }, [imageDimension, activeImageValue, valueImages]);

  const activeImageObjectUrl = useObjectUrl(activeImageFile);
  const activeImagePreviewUrl = useMemo(() => {
    if (activeImageObjectUrl) return activeImageObjectUrl;
    if (!imageDimension || !activeImageValue) return null;
    const key = normalizeVariationValueKey(imageDimension, activeImageValue);
    return valueImages[key]?.previewUrl || valueImages[key]?.imageUrl || null;
  }, [activeImageObjectUrl, imageDimension, activeImageValue, valueImages]);

  // Ref tracking the newly added chip for scroll-into-view
  const lastAddedValueRef = useRef<{ dimId: string; value: string } | null>(null);

  // Helper to build rows carrying over existing quantities and prices
  const computeRows = (
    currentDims: VariationDimension[],
    prevRows: VariationRow[]
  ): VariationRow[] => {
    const qtyMap = new Map<string, number | ''>();
    const priceMap = new Map<string, number | ''>();
    const dbIdMap = new Map<string, string | undefined>();
    const isActiveMap = new Map<string, boolean | undefined>();
    prevRows.forEach((r) => {
      qtyMap.set(r.key, r.quantity);
      priceMap.set(r.key, r.price ?? '');
      if (r.dbId) dbIdMap.set(r.key, r.dbId);
      if (r.isActive !== undefined) isActiveMap.set(r.key, r.isActive);
    });

    const combos = cartesianProduct(currentDims);

    return combos.map((combo) => {
      // Build collision-safe normalized key
      const sortedEntries = Object.keys(combo)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => [k.toLowerCase(), combo[k].toLowerCase()]);
      const key = JSON.stringify(sortedEntries);

      const existingQty = qtyMap.has(key) ? qtyMap.get(key)! : 0;
      const existingPrice = priceMap.has(key) ? priceMap.get(key)! : '';

      const colorKey = Object.keys(combo).find((k) => k.toLowerCase() === 'color');
      const sizeKey = Object.keys(combo).find((k) => k.toLowerCase() === 'size');

      return {
        key,
        dbId: dbIdMap.get(key),
        isActive: isActiveMap.has(key) ? isActiveMap.get(key) : true,
        color: colorKey ? combo[colorKey] : null,
        size: sizeKey ? combo[sizeKey] : null,
        attributes: combo,
        price: existingPrice,
        quantity: existingQty,
      };
    });
  };

  // Internal rows state initialized from saved rows or computed
  const [rows, setRows] = useState<VariationRow[]>(() => {
    if (variationConfig?.rows && variationConfig.rows.length > 0) {
      return variationConfig.rows.map((r) => ({
        ...r,
        price: r.price !== undefined && r.price !== null ? r.price : '',
        quantity: r.quantity !== undefined && r.quantity !== null ? r.quantity : 0,
      }));
    }
    return computeRows(dimensions, []);
  });

  // Check if variation structure belongs to an existing database product
  const isExistingProductVariant = useMemo(
    () => dimensions.some((d) => Boolean(d.dbId)),
    [dimensions]
  );

  // Query 4: Fetch variation images (only on the variation page, once per product)
  useEffect(() => {
    if (!isEditMode || !targetProductId) return;

    let cancelled = false;
    const abortController = new AbortController();

    const fetchOptionImages = async () => {
      setSectionState('optionImages', { status: 'loading', error: null });
      try {
        const { data, error } = await supabase
          .from('product_option_images')
          .select('id, product_option_value_id, storage_path, image_url, created_at')
          .eq('product_id', targetProductId)
          .order('created_at', { ascending: true })
          .abortSignal(abortController.signal);

        if (cancelled) return;
        if (error) throw error;

        // Restore each image against its product_option_value_id
        // Data is sorted by created_at ascending -> first row per value is the oldest!
        const seenValIds = new Set<string>();
        const loadedValueImages: Record<string, any> = {};

        (data || []).forEach((row: any) => {
          if (!row.product_option_value_id) return;
          if (seenValIds.has(row.product_option_value_id)) {
            // Keep oldest, ignore subsequent duplicate rows
            return;
          }
          seenValIds.add(row.product_option_value_id);

          const dim = dimensions.find((d) => d.valueIds && Object.values(d.valueIds).includes(row.product_option_value_id));
          if (dim && dim.valueIds) {
            const valName = Object.entries(dim.valueIds).find(([_, id]) => id === row.product_option_value_id)?.[0];
            if (valName) {
              const normKey = normalizeVariationValueKey(dim.name, valName);
              const publicUrl = row.image_url || supabase.storage.from('productImages').getPublicUrl(row.storage_path).data.publicUrl;
              loadedValueImages[normKey] = {
                id: row.id,
                storagePath: row.storage_path,
                imageUrl: row.image_url || publicUrl,
                previewUrl: publicUrl,
              };
            }
          }
        });

        setValueImages((prev) => ({
          ...loadedValueImages,
          ...prev,
        }));

        setSectionState('optionImages', { status: 'loaded', error: null });
      } catch (err: any) {
        if (cancelled || abortController.signal.aborted) return;
        setSectionState('optionImages', { status: 'error', error: err?.message || 'Failed to load variation photos' });
      }
    };

    fetchOptionImages();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [isEditMode, targetProductId, dimensions, setSectionState, optionImagesReloadToken]);

  // Calculate total values count across all dimensions for conditional image section visibility
  const totalValuesCount = dimensions.reduce((acc, dim) => acc + dim.values.length, 0);
  const showVariationImages = totalValuesCount > 0;

  // Auto-select initial image dimension if none selected or selection became invalid
  useEffect(() => {
    if (!showVariationImages) {
      setImageDimension('');
      setActiveImageValue('');
      return;
    }

    const currentValid = dimensions.some((d) => d.name === imageDimension && d.values.length > 0);
    if (!currentValid) {
      const firstWithVals = dimensions.find((d) => d.values.length > 0);
      if (firstWithVals) {
        setImageDimension(firstWithVals.name);
      } else {
        setImageDimension('');
      }
    }
  }, [showVariationImages, dimensions, imageDimension]);

  // Keep activeImageValue in sync when imageDimension changes
  useEffect(() => {
    if (!imageDimension) {
      setActiveImageValue('');
      return;
    }
    const dim = dimensions.find((d) => d.name === imageDimension);
    if (dim && dim.values.length > 0) {
      if (!dim.values.includes(activeImageValue)) {
        setActiveImageValue(dim.values[0]);
      }
    } else {
      setActiveImageValue('');
    }
  }, [imageDimension, dimensions, activeImageValue]);

  // Real price range helper derived solely from combination row prices (does not read parent Selling Price)
  const priceRange = useMemo(() => getPriceRange(rows), [rows]);
  const priceDisplayText = useMemo(() => formatPriceRange(priceRange), [priceRange]);

  // Handler: Add new variation dimension
  const handleAddDimension = (nameToAdd?: string) => {
    if (isExistingProductVariant) {
      setDimensionError('Dimension structure is locked for existing products to preserve SKU combination integrity.');
      return;
    }
    const targetName = (nameToAdd || newDimensionName).trim();
    setDimensionError(null);
    setGeneralError(null);

    if (!targetName) {
      setDimensionError('Dimension name cannot be empty.');
      return;
    }
    if (targetName.length > 30) {
      setDimensionError('Dimension name cannot exceed 30 characters.');
      return;
    }
    const lower = targetName.toLowerCase();
    if (dimensions.some((d) => d.name.toLowerCase() === lower)) {
      setDimensionError(`Dimension "${targetName}" already exists.`);
      return;
    }

    const newDim: VariationDimension = {
      id: `dim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: targetName,
      enabled: true,
      values: [],
    };

    const nextDims = [...dimensions, newDim];
    setDimensions(nextDims);
    setNewDimensionName('');
  };

  // Handler: Remove dimension
  const handleRemoveDimension = (dimId: string) => {
    if (isExistingProductVariant) {
      setGeneralError('Removing dimensions is disabled on existing products to preserve SKU combination integrity.');
      return;
    }
    const target = dimensions.find((d) => d.id === dimId);
    if (!target) return;

    if (target.values.length > 0) {
      const confirmDelete = window.confirm(
        `Are you sure you want to remove the "${target.name}" dimension and its values?`
      );
      if (!confirmDelete) return;
    }

    // Clean up valueImages belonging to this dimension
    const dimPrefix = `${target.name.trim().toLowerCase()}::`;
    setValueImages((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(dimPrefix)) {
          delete next[key];
        }
      });
      return next;
    });

    const nextDims = dimensions.filter((d) => d.id !== dimId);
    setDimensions(nextDims);

    if (imageDimension === target.name) {
      setImageDimension('');
    }

    setRows((prev) => computeRows(nextDims, prev));
  };

  // Handler: Toggle dimension enabled/disabled
  const handleToggleDimension = (dimId: string) => {
    if (isExistingProductVariant) {
      setGeneralError('Disabling dimensions is restricted on existing products to preserve SKU combination completeness.');
      return;
    }
    setGeneralError(null);
    const nextDims = dimensions.map((d) =>
      d.id === dimId ? { ...d, enabled: !d.enabled } : d
    );
    setDimensions(nextDims);
    setRows((prev) => computeRows(nextDims, prev));
  };

  // Handler: Add value to dimension
  const handleAddValue = (dimId: string) => {
    const dim = dimensions.find((d) => d.id === dimId);
    if (!dim) return;

    const rawVal = (valueInputs[dimId] || '').trim();
    setValueErrors((prev) => ({ ...prev, [dimId]: null }));
    setGeneralError(null);

    if (!rawVal) {
      setValueErrors((prev) => ({ ...prev, [dimId]: 'Value cannot be empty.' }));
      return;
    }
    if (rawVal.length > 30) {
      setValueErrors((prev) => ({ ...prev, [dimId]: 'Value cannot exceed 30 characters.' }));
      return;
    }

    const lower = rawVal.toLowerCase();
    if (dim.values.some((v) => v.toLowerCase() === lower)) {
      setValueErrors((prev) => ({ ...prev, [dimId]: `"${rawVal}" has already been added to ${dim.name}.` }));
      return;
    }

    if (dim.values.length >= MAX_VALUES_PER_DIMENSION) {
      setValueErrors((prev) => ({
        ...prev,
        [dimId]: `Maximum ${MAX_VALUES_PER_DIMENSION} values allowed for ${dim.name}.`,
      }));
      return;
    }

    // Check projected combinations limit
    const nextDims = dimensions.map((d) =>
      d.id === dimId ? { ...d, values: [...d.values, rawVal] } : d
    );

    const enabledWithVals = nextDims.filter((d) => d.enabled && d.values.length > 0);
    const projectedCombinations =
      enabledWithVals.length === 0
        ? 0
        : enabledWithVals.reduce((prod, d) => prod * d.values.length, 1);

    if (projectedCombinations > MAX_TOTAL_COMBINATIONS) {
      setValueErrors((prev) => ({
        ...prev,
        [dimId]: `Adding this value would exceed the maximum limit of ${MAX_TOTAL_COMBINATIONS} combinations.`,
      }));
      return;
    }

    lastAddedValueRef.current = { dimId, value: rawVal };
    setDimensions(nextDims);
    setValueInputs((prev) => ({ ...prev, [dimId]: '' }));
    setRows((prev) => computeRows(nextDims, prev));
  };

  // Handler: Remove value from dimension
  const handleRemoveValue = (dimId: string, valToRemove: string) => {
    const dim = dimensions.find((d) => d.id === dimId);
    const nextDims = dimensions.map((d) =>
      d.id === dimId ? { ...d, values: d.values.filter((v) => v !== valToRemove) } : d
    );
    setDimensions(nextDims);

    // Clean up valueImages entry for this value (no orphaned images)
    if (dim) {
      const key = normalizeVariationValueKey(dim.name, valToRemove);
      setValueImages((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    setRows((prev) => computeRows(nextDims, prev));
  };

  // Process single image file selection (one image per option, replace flow, warn if multiple dropped)
  const processImageFileSelection = (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;
    if (!imageDimension || !activeImageValue) return;

    const files = Array.from(fileList);
    if (files.length > 1) {
      setImageWarning('One image per option. Only the first file was kept.');
    } else {
      setImageWarning(null);
    }

    const file = files[0];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setImageWarning('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setImageWarning('Image size exceeds 10MB. Please select a smaller image.');
      return;
    }

    const key = normalizeVariationValueKey(imageDimension, activeImageValue);
    setValueImages((prev) => ({
      ...prev,
      [key]: { file },
    }));
  };

  // Handler: Upload single image for the active dimension value via input
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    processImageFileSelection(e.target.files);
    e.target.value = '';
  };

  // Handler: Remove uploaded image for active dimension value
  const handleRemoveImage = () => {
    if (!imageDimension || !activeImageValue) return;
    const key = normalizeVariationValueKey(imageDimension, activeImageValue);
    setValueImages((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setImageWarning(null);
  };

  // Handler: Select an existing gallery photo for the active dimension value
  const handleSelectGalleryFile = (file: File) => {
    if (!imageDimension || !activeImageValue) return;
    const key = normalizeVariationValueKey(imageDimension, activeImageValue);
    setValueImages((prev) => ({
      ...prev,
      [key]: { file },
    }));
    setImageWarning(null);
  };

  // Handler: Price input change
  const handlePriceChange = (key: string, rawVal: string) => {
    setGeneralError(null);
    if (rowErrors[key]) {
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    if (rawVal === '') {
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, price: '' } : r))
      );
      return;
    }

    // Decimal input validation: digits with up to 2 decimal places, no negative sign
    if (!/^\d*\.?\d{0,2}$/.test(rawVal)) {
      return;
    }

    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 10000000) {
      return;
    }

    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, price: rawVal as any } : r))
    );
  };

  // Handler: Quantity input change
  const handleQuantityChange = (key: string, rawVal: string) => {
    setGeneralError(null);
    if (rawVal === '') {
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, quantity: '' } : r))
      );
      return;
    }

    const cleanNumber = rawVal.replace(/\D/g, '');
    const parsed = cleanNumber === '' ? '' : parseInt(cleanNumber, 10);
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, quantity: parsed } : r))
    );
  };

  // Handler: Save variations
  const handleSave = () => {
    setGeneralError(null);

    const enabledDims = dimensions.filter((d) => d.enabled);

    if (enabledDims.length === 0) {
      setGeneralError('Please add and enable at least one variation dimension (e.g. Color, Size, Material).');
      return;
    }

    for (const dim of enabledDims) {
      if (dim.values.length === 0) {
        setGeneralError(`Dimension "${dim.name}" is enabled but has no values. Please add at least one value or disable it.`);
        return;
      }
    }

    if (rows.length === 0) {
      setGeneralError('No variation combinations generated. Please ensure active dimensions have values.');
      return;
    }

    // Price validation: every row must have price greater than 0
    const errorsMap: Record<string, string> = {};
    let hasPriceError = false;

    for (const r of rows) {
      const p = typeof r.price === 'string' ? parseFloat(r.price) : r.price;
      if (r.price === '' || isNaN(p) || p <= 0) {
        errorsMap[r.key] = 'Price must be > 0';
        hasPriceError = true;
      }
    }

    if (hasPriceError) {
      setRowErrors(errorsMap);
      setGeneralError('Please enter a valid price greater than 0 for all combination rows.');
      return;
    }

    // Quantity validation: total quantity across all rows > 0
    const totalQty = rows.reduce((sum, r) => {
      const q = r.quantity === '' ? 0 : Number(r.quantity);
      return sum + (Number.isInteger(q) && q > 0 ? q : 0);
    }, 0);

    if (totalQty <= 0) {
      setGeneralError('Total quantity across all variation combinations must be greater than 0.');
      return;
    }

    // Sanitize row prices and quantities
    const sanitizedRows: VariationRow[] = rows.map((r) => ({
      ...r,
      price: typeof r.price === 'number' ? r.price : Number(parseFloat(String(r.price)).toFixed(2)),
      quantity: r.quantity === '' ? 0 : Number(r.quantity),
    }));

    // Filter valueImages to only active values of enabled dimensions
    const savedValueImages: Record<
      string,
      { file?: File; storagePath?: string; imageUrl?: string; previewUrl?: string; id?: string }
    > = {};
    for (const dim of enabledDims) {
      for (const val of dim.values) {
        const key = normalizeVariationValueKey(dim.name, val);
        const entry = valueImages[key];
        if (entry) {
          if (entry.file instanceof File) {
            savedValueImages[key] = { file: entry.file };
          } else if (entry.imageUrl || entry.storagePath) {
            savedValueImages[key] = {
              id: entry.id,
              storagePath: entry.storagePath,
              imageUrl: entry.imageUrl,
              previewUrl: entry.previewUrl || entry.imageUrl,
            };
          }
        }
      }
    }

    const colorDim = dimensions.find((d) => d.name.toLowerCase() === 'color');
    const sizeDim = dimensions.find((d) => d.name.toLowerCase() === 'size');

    const config: VariationConfig = {
      dimensions,
      imageDimension: imageDimension || null,
      valueImages: savedValueImages,
      rows: sanitizedRows,
      useColor: Boolean(colorDim?.enabled),
      useSize: Boolean(sizeDim?.enabled),
      colors: colorDim?.values || [],
      sizes: sizeDim?.values || [],
    };

    setVariationConfig(config);
    router.push(returnUrl);
  };

  const handleBack = () => {
    router.push(returnUrl);
  };

  const handleRemoveAllVariations = () => {
    if (isExistingProductVariant) {
      alert('Existing products with variations cannot be converted to simple products.');
      return;
    }
    const confirmed = window.confirm(
      'Are you sure you want to remove all variations? This will restore single quantity tracking on the listing.'
    );
    if (!confirmed) return;

    setVariationConfig(null);
    router.push(returnUrl);
  };

  const hasSavedVariations = Boolean(variationConfig && variationConfig.rows && variationConfig.rows.length > 0);
  const activeDimensions = dimensions.filter((d) => d.enabled && d.values.length > 0);

  // Selected image dimension record
  const selectedImageDimObj = dimensions.find((d) => d.name === imageDimension);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in text-stone-800 pb-12 min-w-0">
      {/* Page Header (No ResellerHeader, standalone clean title) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-stone-300 min-w-0">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 rounded-lg border border-stone-300 hover:border-stone-900 bg-white hover:bg-stone-50 text-stone-700 transition-colors cursor-pointer shrink-0"
            title="Return to form"
            aria-label="Back to listing form"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg sm:text-2xl font-extrabold uppercase tracking-tight text-stone-900 leading-tight truncate">
            Add Variation
          </h1>
        </div>

        {priceDisplayText && (
          <div className="px-3 py-1 bg-stone-200/80 rounded-md text-xs font-bold text-stone-800 shrink-0">
            {priceDisplayText}
          </div>
        )}
      </div>

      {/* Global Error Banner */}
      {generalError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700 font-medium min-w-0">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* CONTAINER 1: Variation */}
      <div className="bg-stone-50 p-4 sm:p-6 rounded-xl border border-stone-200 shadow-sm space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-stone-200 min-w-0">
          <div>
            <h2 className="text-base font-semibold text-stone-900 uppercase tracking-wider">
              Variation
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Add your variation options.
            </p>
          </div>
        </div>

        {/* Top Control: Add New Dimension or Locked Notification */}
        {isExistingProductVariant ? (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 min-w-0">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Dimension Structure Locked</span>
            </div>
            <p className="text-2xs text-stone-600 leading-relaxed">
              Variation dimensions (e.g. Color, Size) are locked for this existing product to safeguard historical SKU combinations and inventory records. You can still add/edit values, update prices and quantities, and assign variation images below.
            </p>
          </div>
        ) : (
          <div className="p-3.5 bg-white rounded-xl border border-stone-200 space-y-3 min-w-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
              <input
                type="text"
                maxLength={30}
                placeholder="Add variation (Color, Size, Material)"
                value={newDimensionName}
                onChange={(e) => {
                  setNewDimensionName(e.target.value);
                  if (dimensionError) setDimensionError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDimension();
                  }
                }}
                className="flex-1 p-2.5 bg-white border border-stone-300 rounded-lg text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-stone-900 min-h-[40px] min-w-0"
              />
              <button
                type="button"
                onClick={() => handleAddDimension()}
                disabled={!newDimensionName.trim()}
                className="px-4 py-2.5 bg-stone-900 hover:bg-black disabled:bg-stone-300 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed min-h-[40px] flex items-center justify-center space-x-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {dimensionError && <p className="text-xs text-red-600 font-medium">{dimensionError}</p>}

            {/* Quick Suggestion Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-2xs uppercase tracking-wider text-stone-500 font-bold">Suggestions:</span>
              {['Color', 'Size', 'Material'].map((sug) => {
                const alreadyExists = dimensions.some((d) => d.name.toLowerCase() === sug.toLowerCase());
                if (alreadyExists) return null;
                return (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleAddDimension(sug)}
                    className="px-2.5 py-1 text-2xs font-bold rounded-md bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-300 hover:border-stone-800 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>{sug}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dimensions Cards Grid */}
        {dimensions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
            {dimensions.map((dim) => {
              const currentInput = valueInputs[dim.id] || '';
              const currentError = valueErrors[dim.id];
              return (
                <div
                  key={dim.id}
                  className={`p-4 rounded-xl border transition-all min-w-0 ${
                    dim.enabled ? 'bg-white border-stone-300 shadow-xs' : 'bg-stone-100/60 border-stone-200 opacity-75'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
                    <label className={`flex items-center space-x-2.5 select-none min-w-0 ${isExistingProductVariant ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={dim.enabled}
                        disabled={isExistingProductVariant}
                        onChange={() => handleToggleDimension(dim.id)}
                        className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      />
                      <span className="font-bold text-stone-900 uppercase tracking-wide text-xs sm:text-sm truncate">
                        {dim.name}
                      </span>
                    </label>

                    <div className="flex items-center space-x-2 shrink-0">
                      {dim.enabled && (
                        <span className="text-[11px] font-semibold text-stone-500">
                          {dim.values.length} / {MAX_VALUES_PER_DIMENSION}
                        </span>
                      )}
                      {!isExistingProductVariant && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDimension(dim.id)}
                          className="p-1 text-stone-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title={`Remove ${dim.name} dimension`}
                          aria-label={`Remove ${dim.name} dimension`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {dim.enabled && (
                    <div className="space-y-3 pt-1 min-w-0">
                      {/* Input + Add button */}
                      <div className="flex items-center space-x-2 min-w-0">
                        <input
                          type="text"
                          maxLength={30}
                          placeholder={`Add ${dim.name.toLowerCase()} value...`}
                          value={currentInput}
                          onChange={(e) => {
                            setValueInputs((prev) => ({ ...prev, [dim.id]: e.target.value }));
                            if (currentError) {
                              setValueErrors((prev) => ({ ...prev, [dim.id]: null }));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddValue(dim.id);
                            }
                          }}
                          disabled={dim.values.length >= MAX_VALUES_PER_DIMENSION}
                          className="flex-1 p-2.5 bg-white border border-stone-300 rounded-lg text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-stone-900 min-h-[40px] disabled:bg-stone-100 disabled:cursor-not-allowed min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddValue(dim.id)}
                          disabled={!currentInput.trim() || dim.values.length >= MAX_VALUES_PER_DIMENSION}
                          className="px-4 py-2.5 bg-stone-900 hover:bg-black disabled:bg-stone-300 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed min-h-[40px] flex items-center space-x-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>

                      {currentError && <p className="text-xs text-red-600 font-medium">{currentError}</p>}
                      {dim.values.length >= MAX_VALUES_PER_DIMENSION && (
                        <p className="text-2xs text-amber-700 font-medium">Maximum 20 values reached.</p>
                      )}

                      {/* Section 6: Options in One Horizontally Scrollable Row */}
                      {dim.values.length > 0 && (
                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden max-w-full min-w-0 pb-2 overscroll-x-contain scroll-smooth touch-pan-x [-webkit-overflow-scrolling:touch] scrollbar-thin scrollbar-thumb-stone-300">
                          {dim.values.map((val) => (
                            <span
                              key={val}
                              ref={(el) => {
                                if (
                                  lastAddedValueRef.current?.dimId === dim.id &&
                                  lastAddedValueRef.current?.value === val
                                ) {
                                  el?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
                                  lastAddedValueRef.current = null;
                                }
                              }}
                              tabIndex={0}
                              onFocus={(e) => {
                                e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' });
                              }}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-stone-300 rounded-md text-xs font-semibold text-stone-800 shadow-2xs shrink-0 whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-stone-900"
                            >
                              <span className="truncate max-w-[120px]">{val}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveValue(dim.id, val)}
                                onFocus={(e) => {
                                  e.currentTarget.parentElement?.scrollIntoView({
                                    inline: 'nearest',
                                    block: 'nearest',
                                  });
                                }}
                                aria-label={`Remove ${val}`}
                                className="p-0.5 text-stone-400 hover:text-red-600 rounded transition-colors cursor-pointer shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONTAINER 2: Variation Images (Only rendered when at least one variation value exists) */}
      {showVariationImages && (
        <div className="bg-stone-50 p-4 sm:p-6 rounded-xl border border-stone-200 shadow-sm space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-stone-200 min-w-0">
            <div>
              <h2 className="text-base font-semibold text-stone-900 uppercase tracking-wider flex items-center space-x-2">
                <span>Variation Images</span>
              </h2>
              <p className="text-sm text-stone-500 mt-0.5">
                Upload photos corresponding to a specific variation.
              </p>
            </div>

            {/* Dimension Selector Dropdown: default is 'No Selection' */}
            <div className="w-full sm:w-64 shrink-0">
              <label htmlFor="select-variation-image-dimension" className="sr-only">
                Variation Dimension for Images
              </label>
              <select
                id="select-variation-image-dimension"
                value={imageDimension}
                onChange={(e) => setImageDimension(e.target.value)}
                className="w-full p-2.5 border border-stone-300 focus:border-stone-900 rounded-lg text-xs font-semibold text-stone-900 bg-white cursor-pointer"
              >
                <option value="">No Selection</option>
                {dimensions.map((dim) => (
                  <option key={dim.id} value={dim.name}>
                    {dim.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Warning Message if extra files were attempted */}
          {imageWarning && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center space-x-2 text-xs text-amber-800 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{imageWarning}</span>
            </div>
          )}

          {/* Dimension Values and Single Image Upload Area */}
          {imageDimension && selectedImageDimObj && (
            <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-4 min-w-0">
              

              {/* Option Images Loading & Error States */}
              {editSections.optionImages.status === 'loading' && (
                <div className="p-3 bg-stone-100 rounded-lg flex items-center space-x-2 text-xs text-stone-600 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-700" />
                  <span>Loading saved variation photos...</span>
                </div>
              )}
              {editSections.optionImages.status === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{editSections.optionImages.error || 'Failed to load variation photos.'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSectionState('optionImages', { status: 'idle', error: null });
                      setOptionImagesReloadToken((token) => token + 1);
                    }}
                    className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-semibold rounded text-xs transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {selectedImageDimObj.values.length === 0 ? (
                <div className="p-4 border border-dashed border-stone-300 rounded-lg bg-stone-50 text-center text-xs text-stone-500">
                  No values added for <strong>{imageDimension}</strong> yet. Add values in the dimension section above to upload photos.
                </div>
              ) : (
                <>
                  {/* Selectable Option Tabs */}
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {selectedImageDimObj.values.map((val) => {
                      const valKey = normalizeVariationValueKey(imageDimension, val);
                      const hasImg = Boolean(
                        valueImages[valKey]?.file ||
                        valueImages[valKey]?.storagePath ||
                        valueImages[valKey]?.imageUrl
                      );
                      const isSelected = activeImageValue === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setActiveImageValue(val);
                            setImageWarning(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                            isSelected
                              ? 'bg-stone-900 text-white shadow-xs'
                              : 'bg-stone-50 text-stone-700 border border-stone-300 hover:border-stone-800'
                          }`}
                        >
                          <span>{val}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {hasImg ? '1' : '0'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Value: Single Image Management (One Image per Option, Replace Flow) */}
                  {activeImageValue && (
                    <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 space-y-3 min-w-0">
                      {/* Hidden single file input */}
                      <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />

                      {/* Display Single Image Preview or Empty Upload Card */}
                      {activeImagePreviewUrl ? (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center gap-4">
                            <div className="relative w-28 h-28 rounded-lg overflow-hidden border border-stone-300 shadow-xs bg-stone-100 group shrink-0">
                              <img
                                src={activeImagePreviewUrl}
                                alt={`${activeImageValue} photo`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={handleRemoveImage}
                                aria-label={`Remove photo for ${activeImageValue}`}
                                className="absolute top-1.5 right-1.5 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-xs cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.2 bg-black/70 text-white text-[9px] font-bold rounded">
                                1 Image
                              </span>
                            </div>
                            <div className="text-xs text-stone-500 space-y-1">
                              <p className="font-semibold text-stone-700">Photo attached for {activeImageValue}</p>
                              <p className="text-stone-400">
                                This image will be linked to this value in product option images. If it matches a gallery photo, it uploads only once.
                              </p>
                            </div>
                          </div>

                          {/* Gallery Photos quick-select for easy reuse */}
                          {galleryItemsWithFile.length > 0 && (
                            <div className="pt-2 border-t border-stone-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
                                Or select from Product Gallery:
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                {galleryItemsWithFile.map((gItem) => (
                                  <GalleryItemThumbnail
                                    key={gItem.id}
                                    file={gItem.file}
                                    isSelected={activeImageFile === gItem.file}
                                    onSelect={() => handleSelectGalleryFile(gItem.file)}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div
                            onClick={() => imageFileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (e.dataTransfer.files) {
                                processImageFileSelection(e.dataTransfer.files);
                              }
                            }}
                            className="p-6 border-2 border-dashed border-stone-300 hover:border-stone-800 bg-white hover:bg-stone-50 transition-colors rounded-lg flex flex-col items-center justify-center cursor-pointer text-center"
                          >
                            <Upload className="w-6 h-6 text-stone-400 mb-1.5" />
                            <span className="text-xs font-bold text-stone-700">
                              Click or drag to upload photo for {activeImageValue}
                            </span>
                            <span className="text-2xs text-stone-400 mt-0.5">
                              Supports JPG, PNG, WEBP (at most 1 image per option)
                            </span>
                          </div>

                          {/* Gallery Photos quick-select */}
                          {galleryItemsWithFile.length > 0 && (
                            <div className="pt-2 border-t border-stone-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
                                Or choose a photo from Product Gallery:
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                {galleryItemsWithFile.map((gItem) => (
                                  <GalleryItemThumbnail
                                    key={gItem.id}
                                    file={gItem.file}
                                    isSelected={false}
                                    onSelect={() => handleSelectGalleryFile(gItem.file)}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONTAINER 3: Combinations (N) */}
      <div className="bg-stone-50 p-4 sm:p-6 rounded-xl border border-stone-200 shadow-sm space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-stone-200 min-w-0">
          <div>
            <h2 className="text-base font-semibold text-stone-900 uppercase tracking-wider">
              Combinations ({rows.length})
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Manage stock and price per combination.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 border border-dashed border-stone-300 rounded-xl bg-white text-center">
            <Tag className="w-6 h-6 text-stone-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              No Variation Rows Yet
            </p>
            <p className="text-2xs sm:text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              Add dimensions and options above to automatically generate your combinations table.
            </p>
          </div>
        ) : (
          <div className="border border-stone-200 rounded-lg overflow-hidden min-w-0 bg-white">
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                <thead className="bg-stone-100 border-b border-stone-200 uppercase font-extrabold text-stone-700 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3.5 font-bold w-12">#</th>
                    <th className="py-2.5 px-3.5 font-bold w-16">Image</th>
                    {activeDimensions.map((dim) => (
                      <th key={dim.id} className="py-2.5 px-3.5 font-bold">
                        {dim.name}
                      </th>
                    ))}
                    <th className="py-2.5 px-3.5 font-bold min-w-[130px]">Price</th>
                    <th className="py-2.5 px-3.5 font-bold min-w-[130px]">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {rows.map((row, index) => {
                    // Lookup associated image for row based on imageDimension
                    const rowImageVal = (imageDimension && row.attributes) ? row.attributes[imageDimension] : null;
                    const rowKey = (imageDimension && rowImageVal) ? normalizeVariationValueKey(imageDimension, rowImageVal) : '';
                    const rowFile = rowKey ? valueImages[rowKey]?.file : null;
                    const rowImageUrl = rowKey ? (valueImages[rowKey]?.previewUrl || valueImages[rowKey]?.imageUrl || null) : null;

                    const labelText = activeDimensions
                      .map((d) => `${d.name}: ${row.attributes?.[d.name] || ''}`)
                      .join(' / ');

                    const rowError = rowErrors[row.key];

                    return (
                      <tr key={row.key} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-2 px-3.5 font-mono text-stone-400 text-2xs">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3.5">
                          <CombinationRowThumbnail file={rowFile} url={rowImageUrl} alt={rowImageVal || 'variation'} />
                        </td>
                        {activeDimensions.map((dim) => (
                          <td key={dim.id} className="py-2 px-3.5 font-semibold text-stone-900">
                            {row.attributes?.[dim.name] ?? '-'}
                          </td>
                        ))}
                        {/* Price Column */}
                        <td className="py-2 px-3.5">
                          <div className="relative flex items-center w-28">
                            <span className="absolute left-2.5 text-stone-400 font-bold text-xs pointer-events-none">Rs</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`Price for ${labelText}`}
                              value={row.price}
                              onChange={(e) => handlePriceChange(row.key, e.target.value)}
                              placeholder="0.00"
                              className={`w-full p-2 pl-8 border rounded-md focus:outline-none text-xs font-semibold text-stone-900 bg-white ${
                                rowError ? 'border-red-500 focus:border-red-600 bg-red-50/20' : 'border-stone-300 focus:border-stone-900'
                              }`}
                            />
                          </div>
                          {rowError && (
                            <p className="text-2xs text-red-600 font-medium mt-0.5">{rowError}</p>
                          )}
                        </td>
                        {/* Quantity Column */}
                        <td className="py-2 px-3.5">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            aria-label={`Quantity for ${labelText}`}
                            value={row.quantity}
                            onChange={(e) => handleQuantityChange(row.key, e.target.value)}
                            onKeyDown={(e) => {
                              if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            className="w-28 p-2 border border-stone-300 focus:border-stone-900 rounded-md focus:outline-none text-xs font-semibold text-stone-900 bg-white"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons at Bottom */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div>
          {hasSavedVariations && (
            <button
              type="button"
              onClick={handleRemoveAllVariations}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove all variations</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 sm:flex-none px-5 py-2.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer min-h-[40px]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-xs min-h-[40px] flex items-center justify-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductVarition;
