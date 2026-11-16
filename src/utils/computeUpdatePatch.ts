import { VariationConfig, VariationRow } from '@/components/reseller/context/ListingDraftContext';

export interface UpdatePatch {
  expectedUpdatedAt: string;
  product?: {
    title?: string;
    description?: string | null;
    defect?: string | null;
  };
  simple?: {
    sellingPrice?: number;
    compareAtPrice?: number | null;
    quantity?: { from: number; to: number };
  };
  images?: {
    desired: Array<{ id: string } | { storagePath: string; imageUrl: string }>;
  };
  customSpecs?: {
    upsert: Array<{ id?: string; name: string; value: string }>;
    removeIds: string[];
  };
  attributeValues?: {
    upsert: Array<{ attributeId: string; value: string | number | boolean | string[] }>;
    removeAttributeIds: string[];
  };
  variations?: {
    optionRenames: Array<{ id: string; name: string }>;
    valueRenames: Array<{ id: string; value: string }>;
    newValues: Array<{ optionId: string; ref: string; value: string }>;
    removedValueIds: string[];
    variantChanges: Array<{
      id: string;
      sellingPrice?: number;
      quantity?: { from: number; to: number };
    }>;
    newVariants: Array<{
      valueRefs: string[];
      sellingPrice: number;
      quantity: number;
    }>;
    deactivatedVariantIds: string[];
    optionImages?: Array<{
      valueId: string;
      image: null | { storagePath: string; imageUrl: string };
    }>;
  };
  conversion?: {
    targetMode: 'simple' | 'variants';
    confirm: true;
  };
}

export type DirtySectionName = 'product' | 'simple' | 'images' | 'customSpecs' | 'attributeValues' | 'variations';

export interface PatchResult {
  patch: UpdatePatch | null;
  isEmpty: boolean;
  dirtySections: Set<DirtySectionName>;
}

export interface BaselineSnapshot {
  expectedUpdatedAt: string;
  title: string;
  description: string | null;
  defect: string | null;
  inventoryMode: 'simple' | 'variants';
  simple?: {
    sellingPrice: number;
    compareAtPrice: number | null;
    quantity: number;
  } | null;
  images: Array<{
    id: string;
    storagePath?: string | null;
    imageUrl?: string | null;
  }>;
  customSpecs: Array<{
    id: string;
    name: string;
    value: string;
  }>;
  specValues: Record<string, string | number | boolean | string[]>;
  variations?: {
    dimensions: Array<{
      id: string;
      name: string;
      values: Array<{ id: string; value: string }>;
    }>;
    rows: Array<{
      dbId?: string;
      key: string;
      price: number | '';
      quantity: number | '';
      isActive?: boolean;
      attributes?: Record<string, string>;
    }>;
    optionImages?: Record<string, { storagePath: string; imageUrl: string } | null>;
  } | null;
}

export interface DraftState {
  formData: {
    suit_title: string;
    description: string;
    defect: string;
    surplus_selling_price: string;
    original_retail_price: string;
    quantity: string;
  };
  existingImages: Array<{
    id?: string;
    storage_path?: string;
    storagePath?: string;
    url?: string;
    imageUrl?: string;
  }>;
  uploadItems: Array<{
    id: string;
    file?: File;
    storagePath?: string | null;
    uploadedUrl?: string | null;
  }>;
  customSpecs: Array<{
    id?: string;
    name: string;
    value: string;
  }>;
  specValues: Record<string, any>;
  variationConfig: VariationConfig | null;
  loadedInventoryMode: 'simple' | 'variants' | null;
}

// ============================================================================
// NORMALIZATION HELPERS (Section 5)
// ============================================================================

export function normalizeText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function normalizeNullableText(val: any): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeMoney(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function normalizeInt(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? Math.floor(val) : parseInt(String(val), 10);
  if (isNaN(n) || n < 0) return null;
  return n;
}

export function areAttributeValuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if ((a === undefined || a === null || a === '') && (b === undefined || b === null || b === '')) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const setA = new Set(a.map((item) => String(item).trim().toLowerCase()));
    const setB = new Set(b.map((item) => String(item).trim().toLowerCase()));
    if (setA.size !== setB.size) return false;
    for (const item of setA) {
      if (!setB.has(item)) return false;
    }
    return true;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Boolean(a) === Boolean(b);
  }
  if (typeof a === 'number' || typeof b === 'number') {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA === numB;
    }
  }
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
}

/**
 * Pure function: computeUpdatePatch (Section 5 & 6)
 * Compares baseline against draft and returns only what actually changed.
 * If nothing changed, returns { patch: null, isEmpty: true, dirtySections: new Set() }.
 */
export function computeUpdatePatch(
  baseline: BaselineSnapshot | null | undefined,
  draft: DraftState
): PatchResult {
  const dirtySections = new Set<DirtySectionName>();

  if (!baseline) {
    return {
      patch: null,
      isEmpty: true,
      dirtySections,
    };
  }

  const patch: UpdatePatch = {
    expectedUpdatedAt: baseline.expectedUpdatedAt,
  };

  // --------------------------------------------------------------------------
  // 1. PRODUCT DETAILS (Title, Description, Defect)
  // --------------------------------------------------------------------------
  const draftTitle = normalizeText(draft.formData.suit_title);
  const baseTitle = normalizeText(baseline.title);

  const draftDesc = normalizeNullableText(draft.formData.description);
  const baseDesc = normalizeNullableText(baseline.description);

  const draftDefect = normalizeNullableText(draft.formData.defect);
  const baseDefect = normalizeNullableText(baseline.defect);

  const productChanges: { title?: string; description?: string | null; defect?: string | null } = {};

  if (draftTitle !== baseTitle) {
    productChanges.title = draftTitle;
  }
  if (draftDesc !== baseDesc) {
    productChanges.description = draftDesc;
  }
  if (draftDefect !== baseDefect) {
    productChanges.defect = draftDefect;
  }

  if (Object.keys(productChanges).length > 0) {
    patch.product = productChanges;
    dirtySections.add('product');
  }

  // --------------------------------------------------------------------------
  // 2. SIMPLE PRODUCT STOCK & PRICING (Compare-and-set on stock)
  // --------------------------------------------------------------------------
  const invMode = draft.loadedInventoryMode || baseline.inventoryMode || 'simple';

  if (invMode === 'simple') {
    const draftSp = normalizeMoney(draft.formData.surplus_selling_price);
    const baseSp = normalizeMoney(baseline.simple?.sellingPrice);

    const draftCp = normalizeMoney(draft.formData.original_retail_price);
    const baseCp = normalizeMoney(baseline.simple?.compareAtPrice);

    const draftQty = normalizeInt(draft.formData.quantity);
    const baseQty = normalizeInt(baseline.simple?.quantity);

    const simpleChanges: {
      sellingPrice?: number;
      compareAtPrice?: number | null;
      quantity?: { from: number; to: number };
    } = {};

    if (draftSp !== null && draftSp !== baseSp) {
      simpleChanges.sellingPrice = draftSp;
    }
    if (draftCp !== baseCp) {
      simpleChanges.compareAtPrice = draftCp;
    }
    if (draftQty !== null && baseQty !== null && draftQty !== baseQty) {
      simpleChanges.quantity = {
        from: baseQty,
        to: draftQty,
      };
    }

    if (Object.keys(simpleChanges).length > 0) {
      patch.simple = simpleChanges;
      dirtySections.add('simple');
    }
  }

  // --------------------------------------------------------------------------
  // 3. PRODUCT IMAGES (Sequence / Deletion / Addition)
  // --------------------------------------------------------------------------
  const hasNewUploads = (draft.uploadItems || []).some((item) => Boolean(item.file));
  const baseImageIds = (baseline.images || []).map((img) => img.id).filter(Boolean);
  const draftExistingImageIds = (draft.existingImages || []).map((img) => img.id).filter(Boolean);

  let imagesChanged = false;

  if (hasNewUploads) {
    imagesChanged = true;
  } else if (draftExistingImageIds.length !== baseImageIds.length) {
    imagesChanged = true;
  } else {
    for (let i = 0; i < draftExistingImageIds.length; i++) {
      if (draftExistingImageIds[i] !== baseImageIds[i]) {
        imagesChanged = true;
        break;
      }
    }
  }

  if (imagesChanged) {
    dirtySections.add('images');
    const desired: Array<{ id: string } | { storagePath: string; imageUrl: string }> = [];

    // Kept existing images
    for (const img of draft.existingImages || []) {
      if (img.id) {
        desired.push({ id: img.id });
      } else if (img.storagePath && img.imageUrl) {
        desired.push({ storagePath: img.storagePath, imageUrl: img.imageUrl });
      }
    }
    // New images will be appended by the caller/updateProduct service after upload
    patch.images = { desired };
  }

  // --------------------------------------------------------------------------
  // 4. CUSTOM SPECIFICATIONS (By ID)
  // --------------------------------------------------------------------------
  const baseCustomSpecs = baseline.customSpecs || [];
  const draftCustomSpecs = draft.customSpecs || [];

  const baseSpecsMap = new Map(baseCustomSpecs.map((s) => [s.id, s]));
  const draftSpecsMap = new Map<string, { id?: string; name: string; value: string }>();

  const customSpecsUpsert: Array<{ id?: string; name: string; value: string }> = [];
  const customSpecsRemoveIds: string[] = [];

  for (const ds of draftCustomSpecs) {
    const trimmedName = normalizeText(ds.name);
    const trimmedVal = normalizeText(ds.value);
    if (!trimmedName || !trimmedVal) continue;

    if (ds.id && baseSpecsMap.has(ds.id)) {
      draftSpecsMap.set(ds.id, ds);
      const bs = baseSpecsMap.get(ds.id)!;
      if (normalizeText(bs.name) !== trimmedName || normalizeText(bs.value) !== trimmedVal) {
        customSpecsUpsert.push({
          id: ds.id,
          name: trimmedName,
          value: trimmedVal,
        });
      }
    } else {
      // New specification
      customSpecsUpsert.push({
        name: trimmedName,
        value: trimmedVal,
      });
    }
  }

  for (const bs of baseCustomSpecs) {
    if (!draftSpecsMap.has(bs.id)) {
      customSpecsRemoveIds.push(bs.id);
    }
  }

  if (customSpecsUpsert.length > 0 || customSpecsRemoveIds.length > 0) {
    patch.customSpecs = {
      upsert: customSpecsUpsert,
      removeIds: customSpecsRemoveIds,
    };
    dirtySections.add('customSpecs');
  }

  // --------------------------------------------------------------------------
  // 5. ATTRIBUTE VALUES (By attributeId)
  // --------------------------------------------------------------------------
  const baseSpecValues = baseline.specValues || {};
  const draftSpecValues = draft.specValues || {};

  const attrUpsert: Array<{ attributeId: string; value: string | number | boolean | string[] }> = [];
  const attrRemoveIds: string[] = [];

  const allAttrIds = new Set([...Object.keys(baseSpecValues), ...Object.keys(draftSpecValues)]);

  for (const attrId of allAttrIds) {
    const baseVal = baseSpecValues[attrId];
    const draftVal = draftSpecValues[attrId];

    const isDraftEmpty =
      draftVal === undefined ||
      draftVal === null ||
      draftVal === '' ||
      (Array.isArray(draftVal) && draftVal.length === 0);

    const isBaseEmpty =
      baseVal === undefined ||
      baseVal === null ||
      baseVal === '' ||
      (Array.isArray(baseVal) && baseVal.length === 0);

    if (isDraftEmpty && !isBaseEmpty) {
      attrRemoveIds.push(attrId);
    } else if (!isDraftEmpty) {
      if (isBaseEmpty || !areAttributeValuesEqual(baseVal, draftVal)) {
        attrUpsert.push({
          attributeId: attrId,
          value: draftVal,
        });
      }
    }
  }

  if (attrUpsert.length > 0 || attrRemoveIds.length > 0) {
    patch.attributeValues = {
      upsert: attrUpsert,
      removeAttributeIds: attrRemoveIds,
    };
    dirtySections.add('attributeValues');
  }

  // --------------------------------------------------------------------------
  // 6. VARIATIONS (If inventoryMode === 'variants')
  // --------------------------------------------------------------------------
  if (invMode === 'variants' && draft.variationConfig) {
    const baseVars = baseline.variations;
    const draftDims = draft.variationConfig.dimensions || [];
    const draftRows = draft.variationConfig.rows || [];

    const optionRenames: Array<{ id: string; name: string }> = [];
    const valueRenames: Array<{ id: string; value: string }> = [];
    const newValues: Array<{ optionId: string; ref: string; value: string }> = [];
    const removedValueIds: string[] = [];

    const variantChanges: Array<{
      id: string;
      sellingPrice?: number;
      quantity?: { from: number; to: number };
    }> = [];
    const newVariants: Array<{
      valueRefs: string[];
      sellingPrice: number;
      quantity: number;
    }> = [];
    const deactivatedVariantIds: string[] = [];

    // Map base dimensions & values by DB id
    const baseDimMap = new Map((baseVars?.dimensions || []).map((d) => [d.id, d]));
    const baseValMap = new Map<string, { id: string; value: string; optionId: string }>();
    (baseVars?.dimensions || []).forEach((d) => {
      d.values.forEach((v) => baseValMap.set(v.id, { ...v, optionId: d.id }));
    });

    const draftSeenValIds = new Set<string>();

    for (const dim of draftDims) {
      const dimDbId = dim.dbId || (dim.id?.length === 36 ? dim.id : undefined);
      if (dimDbId && baseDimMap.has(dimDbId)) {
        const baseDim = baseDimMap.get(dimDbId)!;
        if (normalizeText(dim.name) !== normalizeText(baseDim.name)) {
          optionRenames.push({ id: dimDbId, name: normalizeText(dim.name) });
        }
      }

      for (const val of dim.values) {
        const valDbId = dim.valueIds?.[val];
        if (valDbId && baseValMap.has(valDbId)) {
          draftSeenValIds.add(valDbId);
          const baseVal = baseValMap.get(valDbId)!;
          if (normalizeText(val) !== normalizeText(baseVal.value)) {
            valueRenames.push({ id: valDbId, value: normalizeText(val) });
          }
        } else if (dimDbId) {
          newValues.push({
            optionId: dimDbId,
            ref: val,
            value: normalizeText(val),
          });
        }
      }
    }

    for (const [valId] of baseValMap.entries()) {
      if (!draftSeenValIds.has(valId)) {
        removedValueIds.push(valId);
      }
    }

    // Compare variants
    const baseRowsMap = new Map((baseVars?.rows || []).map((r) => [r.dbId || r.key, r]));
    const draftActiveKeys = new Set<string>();

    for (const r of draftRows) {
      const rKey = r.key;
      draftActiveKeys.add(rKey);
      const rPrice = normalizeMoney(r.price);
      const rQty = normalizeInt(r.quantity) ?? 0;

      const baseRow = baseRowsMap.get(r.dbId || rKey);
      if (baseRow && baseRow.dbId) {
        const basePrice = normalizeMoney(baseRow.price);
        const baseQty = normalizeInt(baseRow.quantity) ?? 0;

        const priceChanged = rPrice !== null && rPrice !== basePrice;
        const qtyChanged = rQty !== baseQty;

        if (priceChanged || qtyChanged) {
          variantChanges.push({
            id: baseRow.dbId,
            ...(priceChanged && rPrice !== null ? { sellingPrice: rPrice } : {}),
            ...(qtyChanged ? { quantity: { from: baseQty, to: rQty } } : {}),
          });
        }
      } else {
        // New variant combination
        const valueRefs: string[] = [];
        if (r.attributes) {
          Object.values(r.attributes).forEach((v) => valueRefs.push(String(v)));
        } else {
          if (r.color) valueRefs.push(r.color);
          if (r.size) valueRefs.push(r.size);
        }
        if (rPrice !== null && rPrice > 0) {
          newVariants.push({
            valueRefs,
            sellingPrice: rPrice,
            quantity: rQty,
          });
        }
      }
    }

    for (const [key, baseRow] of baseRowsMap.entries()) {
      if (baseRow.dbId && baseRow.isActive !== false && !draftActiveKeys.has(baseRow.key)) {
        deactivatedVariantIds.push(baseRow.dbId);
      }
    }

    const hasVariationChanges =
      optionRenames.length > 0 ||
      valueRenames.length > 0 ||
      newValues.length > 0 ||
      removedValueIds.length > 0 ||
      variantChanges.length > 0 ||
      newVariants.length > 0 ||
      deactivatedVariantIds.length > 0;

    if (hasVariationChanges) {
      patch.variations = {
        optionRenames,
        valueRenames,
        newValues,
        removedValueIds,
        variantChanges,
        newVariants,
        deactivatedVariantIds,
      };
      dirtySections.add('variations');
    }
  }

  const isEmpty = dirtySections.size === 0;

  return {
    patch: isEmpty ? null : patch,
    isEmpty,
    dirtySections,
  };
}
