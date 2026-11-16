'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

export interface CustomSpec {
  id: string;
  name: string;
  value: string;
}

export type EditSectionName = 'core' | 'attributes' | 'variations' | 'optionImages';
export type SectionStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface SectionLoadState {
  status: SectionStatus;
  error?: string | null;
}

export const INITIAL_SECTION_STATES: Record<EditSectionName, SectionLoadState> = {
  core: { status: 'idle', error: null },
  attributes: { status: 'idle', error: null },
  variations: { status: 'idle', error: null },
  optionImages: { status: 'idle', error: null },
};

export const INITIAL_INITIALIZED_SECTIONS: Record<EditSectionName, string | null> = {
  core: null,
  attributes: null,
  variations: null,
  optionImages: null,
};

export interface VariationDimension {
  id: string;
  name: string;
  enabled: boolean;
  values: string[];
  dbId?: string;
  ref?: string;
  valueIds?: Record<string, string>;
}

export interface VariationRow {
  key: string;
  color: string | null;
  size: string | null;
  attributes?: Record<string, string>;
  price: number | '';
  quantity: number | '';
  image?: string | null;
  dbId?: string;
  isActive?: boolean;
}

export interface VariationConfig {
  dimensions?: VariationDimension[];
  imageDimension?: string | null;
  valueImages?: Record<
    string,
    {
      file?: File;
      storagePath?: string;
      imageUrl?: string;
      previewUrl?: string;
      id?: string;
    }
  >;
  /** @deprecated Kept for backwards compatibility */
  dimensionImages?: Record<string, Record<string, string[]>>;
  rows: VariationRow[];
  useColor?: boolean;
  useSize?: boolean;
  colors?: string[];
  sizes?: string[];
}

/**
 * Normalizes dimension name and value into a consistent dictionary key:
 * `{dimensionKey}::{normalizedValue}`
 */
export function normalizeVariationValueKey(dimensionName: string, value: string): string {
  return `${(dimensionName || '').trim().toLowerCase()}::${(value || '').trim().toLowerCase()}`;
}

export interface ListingFormData {
  suit_title: string;
  brand: string;
  fabric: string;
  stitching_status: string;
  piece_count: string;
  quantity: string;
  color: string;
  original_retail_price: string;
  surplus_selling_price: string;
  defect: string;
  description: string;
}

export const INITIAL_DRAFT_FORM_DATA: ListingFormData = {
  suit_title: '',
  brand: 'Khaadi',
  fabric: '',
  stitching_status: 'Unstitched',
  piece_count: '',
  quantity: '1',
  color: '',
  original_retail_price: '',
  surplus_selling_price: '',
  defect: 'None (100% Mint Factory Surplus)',
  description: '',
};

export type AttributeValue = string | boolean | string[];

export interface ListingDraftContextType {
  formData: ListingFormData;
  setFormData: React.Dispatch<React.SetStateAction<ListingFormData>>;
  department: string;
  setDepartment: React.Dispatch<React.SetStateAction<string>>;
  departmentId: string;
  setDepartmentId: React.Dispatch<React.SetStateAction<string>>;
  category: string;
  setCategory: React.Dispatch<React.SetStateAction<string>>;
  categoryId: string;
  setCategoryId: React.Dispatch<React.SetStateAction<string>>;
  productType: string;
  setProductType: React.Dispatch<React.SetStateAction<string>>;
  collectionType: string;
  setCollectionType: React.Dispatch<React.SetStateAction<string>>;
  specValues: Record<string, AttributeValue>;
  setSpecValues: React.Dispatch<React.SetStateAction<Record<string, AttributeValue>>>;
  extraOptions: Record<string, string[]>;
  setExtraOptions: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  customSpecs: CustomSpec[];
  setCustomSpecs: React.Dispatch<React.SetStateAction<CustomSpec[]>>;
  existingImages: any[];
  setExistingImages: React.Dispatch<React.SetStateAction<any[]>>;
  uploadItems: any[];
  setUploadItems: React.Dispatch<React.SetStateAction<any[]>>;
  variationConfig: VariationConfig | null;
  setVariationConfig: React.Dispatch<React.SetStateAction<VariationConfig | null>>;
  clearDraft: () => void;

  // Progressive Edit Section States
  editProductId: string | null;
  setEditProductId: React.Dispatch<React.SetStateAction<string | null>>;
  editSections: Record<EditSectionName, SectionLoadState>;
  setSectionState: (section: EditSectionName, state: Partial<SectionLoadState>) => void;
  initialSnapshots: Record<string, any>;
  setInitialSnapshot: (key: string, data: any) => void;
  baselineSnapshot: any | null;
  setBaselineSnapshot: React.Dispatch<React.SetStateAction<any | null>>;
  initializedSections: Record<EditSectionName, string | null>;
  isSectionInitialized: (section: EditSectionName, productId: string) => boolean;
  markSectionInitialized: (section: EditSectionName, productId: string) => void;
  setCategorySelection: (selection: {
    departmentId: string;
    departmentName: string;
    categoryId: string;
    categoryName: string;
  }) => void;
  expectedUpdatedAt: string;
  setExpectedUpdatedAt: React.Dispatch<React.SetStateAction<string>>;
  startEdit: (productId: string) => void;
  goToEdit: (productId: string) => void;
  loadedQuery2Definitions: any[];
  setLoadedQuery2Definitions: React.Dispatch<React.SetStateAction<any[]>>;
  loadedInventoryMode: 'simple' | 'variants' | null;
  setLoadedInventoryMode: React.Dispatch<React.SetStateAction<'simple' | 'variants' | null>>;
  productNotFound: boolean;
  setProductNotFound: React.Dispatch<React.SetStateAction<boolean>>;
}

const ListingDraftContext = createContext<ListingDraftContextType | undefined>(undefined);

export const ListingDraftProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ListingFormData>(INITIAL_DRAFT_FORM_DATA);
  const [department, setDepartment] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [productType, setProductType] = useState<string>('');
  const [collectionType, setCollectionType] = useState<string>('');
  const [specValues, setSpecValues] = useState<Record<string, AttributeValue>>({});
  const [extraOptions, setExtraOptions] = useState<Record<string, string[]>>({});
  const [customSpecs, setCustomSpecs] = useState<CustomSpec[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [uploadItems, setUploadItems] = useState<any[]>([]);
  const [variationConfig, setVariationConfig] = useState<VariationConfig | null>(null);

  // Edit Mode Specific State
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editSections, setEditSections] = useState<Record<EditSectionName, SectionLoadState>>(INITIAL_SECTION_STATES);
  const [initialSnapshots, setInitialSnapshots] = useState<Record<string, any>>({});
  const [baselineSnapshot, setBaselineSnapshot] = useState<any | null>(null);
  const [initializedSections, setInitializedSections] = useState<Record<EditSectionName, string | null>>(INITIAL_INITIALIZED_SECTIONS);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string>('');
  const [loadedQuery2Definitions, setLoadedQuery2Definitions] = useState<any[]>([]);
  const [loadedInventoryMode, setLoadedInventoryMode] = useState<'simple' | 'variants' | null>(null);
  const [productNotFound, setProductNotFound] = useState<boolean>(false);

  const isSectionInitialized = useCallback((section: EditSectionName, productId: string) => {
    return initializedSections[section] === productId;
  }, [initializedSections]);

  const markSectionInitialized = useCallback((section: EditSectionName, productId: string) => {
    setInitializedSections((prev) => ({
      ...prev,
      [section]: productId,
    }));
  }, []);

  const setCategorySelection = useCallback((selection: {
    departmentId: string;
    departmentName: string;
    categoryId: string;
    categoryName: string;
  }) => {
    setDepartmentId(selection.departmentId);
    setDepartment(selection.departmentName);
    setCategoryId(selection.categoryId);
    setCategory(selection.categoryName);
  }, []);

  const setSectionState = useCallback((section: EditSectionName, state: Partial<SectionLoadState>) => {
    setEditSections((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...state,
      },
    }));
  }, []);

  const setInitialSnapshot = useCallback((key: string, data: any) => {
    setInitialSnapshots((prev) => ({
      ...prev,
      [key]: data,
    }));
  }, []);

  const clearDraft = useCallback(() => {
    setFormData(INITIAL_DRAFT_FORM_DATA);
    setDepartment('');
    setDepartmentId('');
    setCategory('');
    setCategoryId('');
    setProductType('');
    setCollectionType('');
    setSpecValues({});
    setExtraOptions({});
    setCustomSpecs([]);
    setExistingImages([]);
    setUploadItems([]);
    setVariationConfig(null);

    setEditProductId(null);
    setEditSections(INITIAL_SECTION_STATES);
    setInitialSnapshots({});
    setBaselineSnapshot(null);
    setInitializedSections(INITIAL_INITIALIZED_SECTIONS);
    setExpectedUpdatedAt('');
    setLoadedQuery2Definitions([]);
    setLoadedInventoryMode(null);
    setProductNotFound(false);
  }, []);

  const startEdit = useCallback((productId: string) => {
    setFormData(INITIAL_DRAFT_FORM_DATA);
    setDepartment('');
    setDepartmentId('');
    setCategory('');
    setCategoryId('');
    setProductType('');
    setCollectionType('');
    setSpecValues({});
    setExtraOptions({});
    setCustomSpecs([]);
    setExistingImages([]);
    setUploadItems([]);
    setVariationConfig(null);

    setEditProductId(productId);
    setEditSections(INITIAL_SECTION_STATES);
    setInitialSnapshots({});
    setBaselineSnapshot(null);
    setInitializedSections(INITIAL_INITIALIZED_SECTIONS);
    setExpectedUpdatedAt('');
    setLoadedQuery2Definitions([]);
    setLoadedInventoryMode(null);
    setProductNotFound(false);
  }, []);

  const goToEdit = useCallback(
    (productId: string) => {
      // Discard every cached edit snapshot before opening the form. Entering the
      // edit screen may change products.updated_at (auto-activation) and a stale
      // snapshot would otherwise produce a false optimistic-concurrency conflict
      // when the seller saves a change such as removing a specification.
      queryClient.removeQueries({ queryKey: ['product-edit'] });
      startEdit(productId);
      router.push(`/dashboard/add-collection?productId=${productId}`);
    },
    [startEdit, router, queryClient]
  );

  return (
    <ListingDraftContext.Provider
      value={{
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
        setEditProductId,
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
        goToEdit,
        loadedQuery2Definitions,
        setLoadedQuery2Definitions,
        loadedInventoryMode,
        setLoadedInventoryMode,
        productNotFound,
        setProductNotFound,
      }}
    >
      {children}
    </ListingDraftContext.Provider>
  );
};

export const useListingDraft = () => {
  const context = useContext(ListingDraftContext);
  if (!context) {
    throw new Error('useListingDraft must be used within a ListingDraftProvider');
  }
  return context;
};

/**
 * Returns min and max price range from variation rows (or price numbers).
 * Uses min and max of valid row prices (> 0). Does not read parent Selling Price.
 */
export function getPriceRange(
  rowsOrPrices?: VariationRow[] | number[] | null
): { min: number | null; max: number | null } {
  if (!rowsOrPrices) return { min: null, max: null };

  let prices: number[] = [];

  if (Array.isArray(rowsOrPrices)) {
    if (rowsOrPrices.length > 0 && typeof rowsOrPrices[0] === 'object' && rowsOrPrices[0] !== null) {
      prices = (rowsOrPrices as VariationRow[])
        .map((r) => {
          if (r.price === '' || r.price === undefined || r.price === null) return NaN;
          return typeof r.price === 'number' ? r.price : parseFloat(String(r.price));
        })
        .filter((p) => typeof p === 'number' && !isNaN(p) && p > 0);
    } else {
      prices = (rowsOrPrices as number[]).filter((p) => typeof p === 'number' && !isNaN(p) && p > 0);
    }
  }

  if (prices.length > 0) {
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }

  return { min: null, max: null };
}

/**
 * Formats price range with 2 decimals.
 * Returns empty string if no valid price is available.
 */
export function formatPriceRange(range: { min: number | null; max: number | null }): string {
  if (range.min === null || range.max === null) return '';
  if (range.min !== range.max) {
    return `Price: ${range.min.toFixed(2)}–${range.max.toFixed(2)}`;
  }
  return `Price: ${range.min.toFixed(2)}`;
}
