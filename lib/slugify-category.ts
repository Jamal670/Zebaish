/**
 * Converts category name to clean URL/database slug.
 * Rules:
 *  1. Lowercase
 *  2. Replace spaces with -
 *  3. Remove/replace & and ,
 *  4. Collapse multiple dashes to single dash
 *  5. Trim leading and trailing dashes
 */
export function toCategorySlug(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[&,]/g, ' ')           // remove or space & and ,
    .replace(/[^a-z0-9]+/g, '-')     // replace spaces and special chars with dash
    .replace(/-{2,}/g, '-')          // collapse multiple dashes
    .replace(/^-+|-+$/g, '');        // trim leading/trailing dashes
}

export interface ParsedCategoryUrl {
  raw: string;
  decoded: string;
  mainCategoryName: string;
  subCategoryName: string | null;
  mainSlug: string | null;
  subSlug: string | null;
  isAll: boolean;
  displayTitle: string;
}

/**
 * Parses URL category param:
 *  1. Decodes URL encoding (e.g. HOME%20%26%20GARDEN -> HOME & GARDEN)
 *  2. Checks for " - " (space-dash-space) to distinguish:
 *     - Main Category only (e.g. "HOME & GARDEN")
 *     - Subcategory (e.g. "HOME & GARDEN - Kitchen, Dining & Bar")
 *  3. Generates normalized slugs for main_slug and sub_slug
 */
export function parseCategoryUrlParam(rawParam: string | string[] | undefined): ParsedCategoryUrl {
  if (!rawParam) {
    return {
      raw: '',
      decoded: 'All Products',
      mainCategoryName: 'All Products',
      subCategoryName: null,
      mainSlug: null,
      subSlug: null,
      isAll: true,
      displayTitle: 'All Products',
    };
  }

  let val = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  if (typeof val !== 'string') {
    return {
      raw: '',
      decoded: 'All Products',
      mainCategoryName: 'All Products',
      subCategoryName: null,
      mainSlug: null,
      subSlug: null,
      isAll: true,
      displayTitle: 'All Products',
    };
  }

  val = val.trim();
  let decoded = val;
  try {
    decoded = decodeURIComponent(val).trim();
  } catch {
    // Keep val as-is if malformed percent encoding
  }

  const upper = decoded.toUpperCase();
  const isAll =
    !decoded ||
    upper === 'ALL' ||
    upper === 'ALL PRODUCTS' ||
    upper.includes('ALL LEFTOVER');

  if (isAll) {
    return {
      raw: val,
      decoded: 'All Products',
      mainCategoryName: 'All Products',
      subCategoryName: null,
      mainSlug: null,
      subSlug: null,
      isAll: true,
      displayTitle: 'All Products',
    };
  }

  // Check if string contains " - " (space-dash-space) for subcategory
  if (decoded.includes(' - ')) {
    const parts = decoded.split(' - ');
    const mainCategoryName = parts[0].trim();
    const subCategoryName = parts.slice(1).join(' - ').trim();

    return {
      raw: val,
      decoded,
      mainCategoryName,
      subCategoryName,
      mainSlug: toCategorySlug(mainCategoryName),
      subSlug: toCategorySlug(subCategoryName),
      isAll: false,
      displayTitle: `${mainCategoryName} - ${subCategoryName}`,
    };
  }

  // Main category only
  return {
    raw: val,
    decoded,
    mainCategoryName: decoded,
    subCategoryName: null,
    mainSlug: toCategorySlug(decoded),
    subSlug: null,
    isAll: false,
    displayTitle: decoded,
  };
}

/**
 * Backwards compatibility helper to get single slug from category param.
 */
export function categoryParamToSlug(raw: string | string[] | undefined): string | null {
  const parsed = parseCategoryUrlParam(raw);
  if (parsed.isAll) return null;
  return parsed.subSlug || parsed.mainSlug || null;
}
