// Shared display helpers for reseller products in table and modal views

export interface ProductPriceQtyFields {
  inventory_mode?: string | null;
  selling_price?: number | null;
  quantity?: number | null;
  cached_min_variant_price?: number | null;
  cached_max_variant_price?: number | null;
  cached_total_variant_quantity?: number | null;
}

/**
 * Formats product price based on inventory_mode:
 * - 'simple': selling_price - selling_price (e.g. "250 - 250")
 * - 'variants': cached_min_variant_price - cached_max_variant_price
 * - null/undefined/invalid: "—" (never null or NaN)
 */
export function formatProductPrice(p: ProductPriceQtyFields): string {
  if (p.inventory_mode === 'simple') {
    if (p.selling_price === null || p.selling_price === undefined || isNaN(Number(p.selling_price))) {
      return '—';
    }
    const val = Math.round(Number(p.selling_price)).toLocaleString();
    return `${val} - ${val}`;
  }
  if (p.inventory_mode === 'variants') {
    if (
      p.cached_min_variant_price === null ||
      p.cached_min_variant_price === undefined ||
      p.cached_max_variant_price === null ||
      p.cached_max_variant_price === undefined ||
      isNaN(Number(p.cached_min_variant_price)) ||
      isNaN(Number(p.cached_max_variant_price))
    ) {
      return '—';
    }
    const min = Math.round(Number(p.cached_min_variant_price)).toLocaleString();
    const max = Math.round(Number(p.cached_max_variant_price)).toLocaleString();
    return `${min} - ${max}`;
  }
  return '—';
}

/**
 * Formats product quantity based on inventory_mode:
 * - 'simple': quantity
 * - 'variants': cached_total_variant_quantity
 * - null/undefined: 0
 */
export function formatProductQty(p: ProductPriceQtyFields): number {
  if (p.inventory_mode === 'simple') {
    return p.quantity !== null && p.quantity !== undefined && !isNaN(Number(p.quantity))
      ? Number(p.quantity)
      : 0;
  }
  if (p.inventory_mode === 'variants') {
    return p.cached_total_variant_quantity !== null &&
      p.cached_total_variant_quantity !== undefined &&
      !isNaN(Number(p.cached_total_variant_quantity))
      ? Number(p.cached_total_variant_quantity)
      : 0;
  }
  return 0;
}

export interface StatusBadgeConfig {
  label: string;
  badgeClassName: string;
  isDeactivated: boolean;
  isSoldOut: boolean;
  isArchived: boolean;
  isDraft: boolean;
}

/**
 * Normalizes lowercase product status and returns label, CSS classes, and flags
 * Handles all five standard status values:
 * - 'active': Active listing with stock
 * - 'inactive': Deactivated by seller, stock preserved, not visible on storefront
 * - 'sold_out': Active listing with zero inventory
 * - 'draft': Legacy/newly initialized un-published product
 * - 'archived': Immutable archive of a product with order history
 */
export function getProductStatusConfig(rawStatus?: string | null): StatusBadgeConfig {
  const status = (rawStatus || '').toLowerCase().trim();
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        badgeClassName: 'bg-emerald-100 text-emerald-800 font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full whitespace-nowrap',
        isDeactivated: false,
        isSoldOut: false,
        isArchived: false,
        isDraft: false,
      };
    case 'inactive':
      return {
        label: 'Inactive',
        badgeClassName: 'bg-stone-200 text-stone-700 font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full whitespace-nowrap',
        isDeactivated: true,
        isSoldOut: false,
        isArchived: false,
        isDraft: false,
      };
    case 'draft':
      return {
        label: 'Draft',
        badgeClassName: 'bg-stone-200 text-stone-700 font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full whitespace-nowrap',
        isDeactivated: true,
        isSoldOut: false,
        isArchived: false,
        isDraft: true,
      };
    case 'sold_out':
      return {
        label: 'Sold out',
        badgeClassName: 'bg-red-100 text-red-800 font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full uppercase whitespace-nowrap',
        isDeactivated: false,
        isSoldOut: true,
        isArchived: false,
        isDraft: false,
      };
    case 'archived':
      return {
        label: 'Archived',
        badgeClassName: 'bg-stone-300 text-stone-700 font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full whitespace-nowrap',
        isDeactivated: true,
        isSoldOut: false,
        isArchived: true,
        isDraft: false,
      };
    default:
      return {
        label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft',
        badgeClassName: 'bg-stone-100 text-stone-700 font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full whitespace-nowrap',
        isDeactivated: true,
        isSoldOut: false,
        isArchived: false,
        isDraft: true,
      };
  }
}

/**
 * Formats a category attribute value avoiding the falsy trap:
 * - boolean: Yes / No (false must show No, never empty)
 * - number: trimmed string (0 must show 0, 16.0000 -> 16)
 * - multi_select / jsonb: comma-joined or valid JSON string (never [object Object])
 * - text / select: value_text
 */
export function formatCategoryAttributeValue(
  row: {
    value_text?: string | null;
    value_number?: number | null;
    value_boolean?: boolean | null;
    value_jsonb?: any;
  },
  dataType?: string | null
): string {
  const dt = (dataType || '').toLowerCase().trim();

  // 1. If dataType is specified, check corresponding column first
  if (dt === 'boolean') {
    if (row.value_boolean !== null && row.value_boolean !== undefined) {
      return row.value_boolean ? 'Yes' : 'No';
    }
  }

  if (dt === 'number') {
    if (row.value_number !== null && row.value_number !== undefined) {
      const num = Number(row.value_number);
      if (!isNaN(num)) {
        return parseFloat(num.toFixed(4)).toString();
      }
      return String(row.value_number);
    }
  }

  if (dt === 'multi_select') {
    if (row.value_jsonb !== null && row.value_jsonb !== undefined) {
      if (Array.isArray(row.value_jsonb)) {
        return row.value_jsonb.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
      }
      if (typeof row.value_jsonb === 'object') {
        return JSON.stringify(row.value_jsonb);
      }
      return String(row.value_jsonb);
    }
  }

  if (dt === 'text' || dt === 'select') {
    if (row.value_text !== null && row.value_text !== undefined && row.value_text !== '') {
      return String(row.value_text);
    }
  }

  // 2. Fallbacks across all four columns in case dt was unspecified or column didn't match dt
  if (row.value_boolean !== null && row.value_boolean !== undefined) {
    return row.value_boolean ? 'Yes' : 'No';
  }

  if (row.value_number !== null && row.value_number !== undefined) {
    const num = Number(row.value_number);
    return !isNaN(num) ? parseFloat(num.toFixed(4)).toString() : String(row.value_number);
  }

  if (row.value_jsonb !== null && row.value_jsonb !== undefined) {
    if (Array.isArray(row.value_jsonb)) {
      return row.value_jsonb.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
    }
    if (typeof row.value_jsonb === 'object') {
      return JSON.stringify(row.value_jsonb);
    }
    return String(row.value_jsonb);
  }

  if (row.value_text !== null && row.value_text !== undefined && row.value_text !== '') {
    return String(row.value_text);
  }

  return '';
}

/**
 * Formats a single price value using the standard project number formatting.
 * Returns '—' for null, undefined, or NaN.
 */
export function formatSinglePrice(val?: number | null): string {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '—';
  }
  return Math.round(Number(val)).toLocaleString();
}

export interface MappedProductAttribute {
  id: string;
  name: string;
  value: string;
  isCategory: boolean;
}

export interface MappedProductVariant {
  id: string;
  combination_key: string;
  selling_price: number | null;
  priceFormatted: string;
  quantity: number | null;
  quantityFormatted: string;
  is_active: boolean;
}

export interface MappedProductInformation {
  id: string;
  title: string;
  status: string;
  statusConfig: StatusBadgeConfig;
  views: number;
  inventoryMode: string;
  priceText: string;
  quantityText: number;
  attributes: MappedProductAttribute[];
  variants: MappedProductVariant[];
  defect: string;
  description: string;
}

/**
 * Pure mapper converting raw product details into clean UI-ready display values.
 * Applies sorting:
 * - Category attributes by definition sort_order (nulls last) then name
 * - Custom attributes by display_order
 * - Product variants numerically by combination_key using Intl.Collator
 */
export function toProductInformation(row: any): MappedProductInformation {
  const priceText = formatProductPrice(row);
  const quantityText = formatProductQty(row);
  const statusConfig = getProductStatusConfig(row.status);
  const views = row.views !== null && row.views !== undefined && !isNaN(Number(row.views))
    ? Number(row.views)
    : 0;
  const title = (row.title || '').trim() || 'Untitled Listing';
  const inventoryMode = row.inventory_mode || 'simple';

  // 1. Category attributes
  const rawCatAttrs = Array.isArray(row.product_attribute_values) ? row.product_attribute_values : [];
  const processedCatAttrs: Array<{
    id: string;
    name: string;
    value: string;
    sortOrder: number;
  }> = [];

  for (const av of rawCatAttrs) {
    const def = av.category_attribute_definitions;
    const name = (def?.name || '').trim() || 'Attribute';
    const value = formatCategoryAttributeValue(av, def?.data_type);
    if (value !== '') {
      processedCatAttrs.push({
        id: av.id || `${av.attribute_id || 'attr'}-${Math.random()}`,
        name,
        value,
        sortOrder: def?.sort_order !== null && def?.sort_order !== undefined ? Number(def.sort_order) : 9999,
      });
    }
  }

  // Sort category attributes: sort_order asc, then name asc
  processedCatAttrs.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.name.localeCompare(b.name);
  });

  const catAttributes: MappedProductAttribute[] = processedCatAttrs.map((ca) => ({
    id: ca.id,
    name: ca.name,
    value: ca.value,
    isCategory: true,
  }));

  // 2. Custom attributes (preserved in Detail section)
  const rawCustomAttrs = Array.isArray(row.product_custom_attributes) ? row.product_custom_attributes : [];
  const processedCustomAttrs: Array<{
    id: string;
    name: string;
    value: string;
    displayOrder: number;
  }> = [];

  for (const ca of rawCustomAttrs) {
    const name = (ca.name || '').trim();
    const value = (ca.value || '').trim();
    if (name.length > 0 && value.length > 0) {
      processedCustomAttrs.push({
        id: ca.id || `custom-${ca.name}-${Math.random()}`,
        name,
        value,
        displayOrder: ca.display_order !== null && ca.display_order !== undefined ? Number(ca.display_order) : 9999,
      });
    }
  }

  // Sort custom attributes: display_order asc
  processedCustomAttrs.sort((a, b) => a.displayOrder - b.displayOrder);

  const customAttributes: MappedProductAttribute[] = processedCustomAttrs.map((ca) => ({
    id: ca.id,
    name: ca.name,
    value: ca.value,
    isCategory: false,
  }));

  // Combined attributes: category attributes first, then custom attributes
  const combinedAttributes = [...catAttributes, ...customAttributes];

  // 3. Variations (from product_variants table)
  // Sorted by combination_key with numeric collation so 'size:2' comes before 'size:10'
  const rawVariants = Array.isArray(row.product_variants) ? row.product_variants : [];
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const sortedVariants = [...rawVariants].sort((a: any, b: any) =>
    collator.compare(a?.combination_key || '', b?.combination_key || '')
  );

  const processedVariants: MappedProductVariant[] = sortedVariants.map((v: any, index: number) => {
    const rawPrice = v.selling_price !== null && v.selling_price !== undefined && !isNaN(Number(v.selling_price))
      ? Number(v.selling_price)
      : null;
    const priceFormatted = formatSinglePrice(rawPrice);

    const rawQty = v.quantity !== null && v.quantity !== undefined && !isNaN(Number(v.quantity))
      ? Number(v.quantity)
      : null;
    const quantityFormatted = rawQty !== null ? String(rawQty) : '—';

    return {
      id: v.id || `var-${index}`,
      combination_key: v.combination_key || '',
      selling_price: rawPrice,
      priceFormatted,
      quantity: rawQty,
      quantityFormatted,
      is_active: v.is_active !== false,
    };
  });

  // 4. Defect & Description
  const rawDefect = (row.condition_details || '').trim();
  const rawDescription = (row.description || '').trim();

  return {
    id: row.id,
    title,
    status: (row.status || '').toLowerCase().trim(),
    statusConfig,
    views,
    inventoryMode,
    priceText,
    quantityText,
    attributes: combinedAttributes,
    variants: processedVariants ?? [],
    defect: rawDefect.length > 0 ? rawDefect : 'Not provided',
    description: rawDescription.length > 0 ? rawDescription : 'Not provided',
  };
}

