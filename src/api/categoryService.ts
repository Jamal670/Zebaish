import supabase from './client';

export interface CategoryRecord {
  id: string;
  name: string;
  parent_id?: string | null;
  slug?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
}

export interface CategoryAttributeDefinition {
  id: string;
  category_id: string;
  name: string;
  slug?: string | null;
  data_type: 'text' | 'number' | 'boolean' | 'select' | 'multi_select' | string;
  options?: any;
  is_required?: boolean;
  is_active?: boolean;
  sort_order?: number | null;
}

/**
 * Normalizes options defensively from various backend formats (jsonb array, stringified JSON,
 * array of strings or {label, value} objects), drops empties, trims, and deduplicates case-insensitively.
 */
export function normalizeAttributeOptions(rawOptions: any): string[] {
  if (!rawOptions) return [];

  let list: any[] = [];
  if (Array.isArray(rawOptions)) {
    list = rawOptions;
  } else if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions);
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === 'object') {
        list = Object.values(parsed);
      } else {
        list = rawOptions.split(',');
      }
    } catch {
      list = rawOptions.split(',');
    }
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of list) {
    let str = '';
    if (typeof item === 'string') {
      str = item;
    } else if (item && typeof item === 'object') {
      str = String(item.value ?? item.label ?? item.name ?? '');
    } else if (item !== null && item !== undefined) {
      str = String(item);
    }

    const trimmed = str.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      normalized.push(trimmed);
    }
  }

  return normalized;
}

/**
 * Fetches top-level categories (departments) where parent_id IS NULL and is_active = true.
 * Ordered by sort_order ascending (nulls last), then name.
 */
export async function fetchTopLevelDepartments(): Promise<CategoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .is('parent_id', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) {
      console.warn('Error fetching departments from categories table:', error.message);
      throw error;
    }

    return data || [];
  } catch (err: any) {
    console.warn('Exception in fetchTopLevelDepartments:', err?.message || err);
    throw err;
  }
}

/**
 * Fetches child categories for a given parent department ID where is_active = true.
 * Ordered by sort_order ascending (nulls last), then name.
 */
export async function fetchCategoriesByDepartment(parentId: string): Promise<CategoryRecord[]> {
  if (!parentId) return [];

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, parent_id')
      .eq('parent_id', parentId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) {
      console.warn(`Error fetching categories for parent_id "${parentId}":`, error.message);
      throw error;
    }

    return data || [];
  } catch (err: any) {
    console.warn('Exception in fetchCategoriesByDepartment:', err?.message || err);
    throw err;
  }
}

/**
 * Fetches attribute definitions for a category where is_active = true.
 * Ordered by sort_order ascending (nulls last), then name.
 */
export async function fetchCategoryAttributeDefinitions(categoryId: string): Promise<CategoryAttributeDefinition[]> {
  if (!categoryId) return [];

  try {
    const { data, error } = await supabase
      .from('category_attribute_definitions')
      .select('id, name, slug, data_type, options, is_required, sort_order')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) {
      console.warn(`Error fetching attribute definitions for category "${categoryId}":`, error.message);
      throw error;
    }

    return (data || []).map((row) => ({
      ...row,
      category_id: categoryId,
      options: normalizeAttributeOptions(row.options),
    }));
  } catch (err: any) {
    console.warn('Exception in fetchCategoryAttributeDefinitions:', err?.message || err);
    throw err;
  }
}
