import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import {
  parseCategoryUrlParam,
  toCategorySlug,
  ParsedCategoryUrl,
} from '@/lib/slugify-category';

export interface CategoryItem {
  id: string;
  parent_id: string | null;
  slug: string | null;
  name: string;
  is_active?: boolean;
}

export interface ResolvedCategory {
  category: CategoryItem | null;
  categoryIds: string[] | null; // null if no category filter (all active products)
  categoryName: string;
  isNotFound: boolean;
  slug: string | null;
  mainCategory?: CategoryItem | null;
  subCategory?: CategoryItem | null;
  parsed?: ParsedCategoryUrl;
}

/**
 * Cached category tree fetch — once per server request.
 */
export const fetchCategoryTree = cache(async (): Promise<CategoryItem[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('id, parent_id, slug, name, is_active')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching categories tree:', error);
    return [];
  }

  return (data || []) as CategoryItem[];
});

/**
 * Resolves a raw URL category param into a target category and all its descendant IDs.
 * Handles:
 *  - Main Category only: e.g. "HOME & GARDEN", "FASHION" -> parent + all subcategory IDs
 *  - Subcategory: e.g. "FASHION - Women Accessories" -> only that subcategory's ID
 *  - All products: empty / "ALL PRODUCTS" -> null categoryIds
 */
export async function resolveCategory(
  rawCategoryParam: string | string[] | undefined
): Promise<ResolvedCategory> {
  const parsed = parseCategoryUrlParam(rawCategoryParam);

  // If param is missing or "ALL PRODUCTS" -> Show all active products
  if (parsed.isAll || !parsed.mainSlug) {
    return {
      category: null,
      categoryIds: null,
      categoryName: 'All Products',
      isNotFound: false,
      slug: null,
      parsed,
    };
  }

  const tree = await fetchCategoryTree();
  if (!tree.length) {
    return {
      category: null,
      categoryIds: null,
      categoryName: 'Category not found',
      isNotFound: true,
      slug: parsed.subSlug || parsed.mainSlug,
      parsed,
    };
  }

  // -------------------------------------------------------------
  // Case A: Only Main Category (no subcategory in URL)
  // -------------------------------------------------------------
  if (!parsed.subSlug) {
    const slugMatches = tree.filter((c) => {
      return c.slug && c.slug.toLowerCase().trim() === parsed.mainSlug;
    });

    let mainCategory: CategoryItem | null = null;
    if (slugMatches.length > 0) {
      mainCategory = slugMatches.find((c) => c.parent_id === null) || slugMatches[0];
    } else {
      // Fallback: match by normalized name slug
      const nameMatches = tree.filter((c) => {
        return toCategorySlug(c.name) === parsed.mainSlug;
      });
      if (nameMatches.length > 0) {
        mainCategory = nameMatches.find((c) => c.parent_id === null) || nameMatches[0];
      }
    }

    if (!mainCategory) {
      return {
        category: null,
        categoryIds: null,
        categoryName: 'Category not found',
        isNotFound: true,
        slug: parsed.mainSlug,
        parsed,
      };
    }

    // Collect that main category's id + all descendant ids iteratively
    const resultIds: string[] = [mainCategory.id];
    let currentParentIds = new Set<string>([mainCategory.id]);

    while (currentParentIds.size > 0) {
      const nextParentIds = new Set<string>();
      for (const item of tree) {
        if (item.parent_id && currentParentIds.has(item.parent_id) && !resultIds.includes(item.id)) {
          resultIds.push(item.id);
          nextParentIds.add(item.id);
        }
      }
      currentParentIds = nextParentIds;
    }

    return {
      category: mainCategory,
      categoryIds: resultIds,
      categoryName: mainCategory.name,
      isNotFound: false,
      slug: mainCategory.slug || parsed.mainSlug,
      mainCategory,
      subCategory: null,
      parsed,
    };
  }

  // -------------------------------------------------------------
  // Case B: Subcategory specified (e.g. "FASHION - Women Accessories")
  // -------------------------------------------------------------
  // 1. Find and validate the main category
  const mainSlugMatches = tree.filter((c) => {
    return c.slug && c.slug.toLowerCase().trim() === parsed.mainSlug;
  });

  let mainCategory: CategoryItem | null = null;
  if (mainSlugMatches.length > 0) {
    mainCategory = mainSlugMatches.find((c) => c.parent_id === null) || mainSlugMatches[0];
  } else {
    const nameMatches = tree.filter((c) => {
      return toCategorySlug(c.name) === parsed.mainSlug;
    });
    if (nameMatches.length > 0) {
      mainCategory = nameMatches.find((c) => c.parent_id === null) || nameMatches[0];
    }
  }

  // 2. Find subcategory whose parent is the main category
  let subCategory: CategoryItem | null = null;
  if (mainCategory) {
    const subMatches = tree.filter((c) => {
      const slugMatch = c.slug && c.slug.toLowerCase().trim() === parsed.subSlug;
      const nameMatch = toCategorySlug(c.name) === parsed.subSlug;
      return (slugMatch || nameMatch) && c.parent_id === mainCategory.id;
    });

    if (subMatches.length > 0) {
      subCategory = subMatches[0];
    }
  }

  // Fallback: match subcategory globally if not found under direct parent
  if (!subCategory) {
    const globalMatches = tree.filter((c) => {
      const slugMatch = c.slug && c.slug.toLowerCase().trim() === parsed.subSlug;
      const nameMatch = toCategorySlug(c.name) === parsed.subSlug;
      return slugMatch || nameMatch;
    });
    if (globalMatches.length > 0) {
      subCategory = globalMatches[0];
    }
  }

  if (!subCategory) {
    return {
      category: null,
      categoryIds: null,
      categoryName: 'Category not found',
      isNotFound: true,
      slug: parsed.subSlug,
      mainCategory,
      subCategory: null,
      parsed,
    };
  }

  // For leaf subcategory: only filter by that subcategory's id
  return {
    category: subCategory,
    categoryIds: [subCategory.id],
    categoryName: subCategory.name,
    isNotFound: false,
    slug: subCategory.slug || parsed.subSlug,
    mainCategory,
    subCategory,
    parsed,
  };
}
