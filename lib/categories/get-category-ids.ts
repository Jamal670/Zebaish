import { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { categoryParamToSlug } from '@/lib/slugify-category';

export interface CategoryNode {
  id: string;
  parent_id: string | null;
  slug: string | null;
  name: string;
  is_active?: boolean;
}

export const CATEGORY_TREE_QUERY_KEY = ['category-tree'] as const;

/**
 * Fetches the entire active category tree once (~100 lightweight rows).
 */
export async function fetchCategoryTreeFromDb(supabase: SupabaseClient): Promise<CategoryNode[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, parent_id, slug, name, is_active')
    .eq('is_active', true);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[get-category-ids] Error fetching categories tree:', error);
    }
    return [];
  }

  return (data || []) as CategoryNode[];
}

/**
 * Resolves a category slug to that category's ID and all of its descendant IDs.
 * Caches the category tree in TanStack Query (30m staleTime) via queryClient.ensureQueryData.
 */
export async function getCategoryAndDescendantIds(
  supabase: SupabaseClient,
  queryClient: QueryClient,
  targetSlug: string
): Promise<string[]> {
  if (!targetSlug) return [];

  const normalizedTarget = targetSlug.trim().toLowerCase();

  let tree: CategoryNode[] = [];
  try {
    tree = await queryClient.ensureQueryData<CategoryNode[]>({
      queryKey: CATEGORY_TREE_QUERY_KEY,
      queryFn: () => fetchCategoryTreeFromDb(supabase),
      staleTime: 30 * 60 * 1000, // 30 minutes
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[getCategoryAndDescendantIds] Failed to ensure query data for category tree:', err);
    }
    tree = await fetchCategoryTreeFromDb(supabase);
  }

  if (!tree || tree.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[getCategoryAndDescendantIds] Category tree is empty.');
    }
    return [];
  }

  // 1. Find the matching category row (case-insensitive; prefer parent_id IS NULL if several match)
  const directSlugMatches = tree.filter(
    (c) => c.slug && c.slug.toLowerCase().trim() === normalizedTarget
  );

  let matchedCategory: CategoryNode | null = null;
  if (directSlugMatches.length > 0) {
    matchedCategory = directSlugMatches.find((c) => c.parent_id === null) || directSlugMatches[0];
  } else {
    // Fallback: match by normalized slugified slug or name
    const paramSlugMatches = tree.filter((c) => {
      const s = c.slug ? categoryParamToSlug(c.slug) : null;
      return s && s.toLowerCase() === normalizedTarget;
    });

    if (paramSlugMatches.length > 0) {
      matchedCategory = paramSlugMatches.find((c) => c.parent_id === null) || paramSlugMatches[0];
    } else {
      const nameMatches = tree.filter((c) => {
        const nameSlug = categoryParamToSlug(c.name || '');
        return (
          (nameSlug && nameSlug.toLowerCase() === normalizedTarget) ||
          c.name.toLowerCase().trim() === normalizedTarget
        );
      });
      if (nameMatches.length > 0) {
        matchedCategory = nameMatches.find((c) => c.parent_id === null) || nameMatches[0];
      }
    }
  }

  if (!matchedCategory) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[getCategoryAndDescendantIds] Category for slug "${targetSlug}" not found.`);
    }
    return [];
  }

  // 2. Iteratively walk parent + all descendant categories for any depth
  const descendantIds: string[] = [matchedCategory.id];
  let currentParentIds = new Set<string>([matchedCategory.id]);

  while (currentParentIds.size > 0) {
    const nextParentIds = new Set<string>();
    for (const item of tree) {
      if (item.parent_id && currentParentIds.has(item.parent_id) && !descendantIds.includes(item.id)) {
        descendantIds.push(item.id);
        nextParentIds.add(item.id);
      }
    }
    currentParentIds = nextParentIds;
  }

  return descendantIds;
}

