import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchNewArrivals, NewArrivalProduct } from '@/lib/home/fetch-new-arrivals';

export const newArrivalsKeys = {
  all: ['new-arrivals'] as const,
  category: (slug: string) => ['new-arrivals', slug] as const,
};

export const NEW_ARRIVALS_STALE_TIME = 5 * 60 * 1000; // 5 minutes
export const NEW_ARRIVALS_GC_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * Hook to fetch the latest active new arrivals for a specific category slug.
 * Uses TanStack Query v5 with 5m staleTime and 10m gcTime.
 * Note: Does NOT use placeholderData: keepPreviousData so switching to an uncached category shows skeleton.
 */
export function useNewArrivals(slug: string) {
  const queryClient = useQueryClient();

  return useQuery<NewArrivalProduct[]>({
    queryKey: newArrivalsKeys.category(slug),
    queryFn: ({ signal }) => fetchNewArrivals(supabase, slug, signal, queryClient),
    enabled: Boolean(slug),
    staleTime: NEW_ARRIVALS_STALE_TIME,
    gcTime: NEW_ARRIVALS_GC_TIME,
    refetchOnWindowFocus: false,
  });
}

/**
 * Helper to prefetch new arrivals for a category slug on hover or focus of category tab.
 */
export function prefetchNewArrivals(
  queryClient: QueryClient,
  supabaseClient: SupabaseClient,
  slug: string
) {
  if (!slug) return;

  return queryClient.prefetchQuery({
    queryKey: newArrivalsKeys.category(slug),
    queryFn: ({ signal }) => fetchNewArrivals(supabaseClient, slug, signal, queryClient),
    staleTime: NEW_ARRIVALS_STALE_TIME,
    gcTime: NEW_ARRIVALS_GC_TIME,
  });
}

