export interface RawReviewBreakdownRow {
  rating: number;
  review_count: number;
}

export interface RawSellerReviewRow {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  product_id: string;
  product_title: string;
  order_id: string | null;
  customer_name: string;
  total_count: number | string;
}

export interface ReviewItemData {
  id: string;
  rating: number;
  review: string;
  status?: string;
  createdAt: string;
  productId: string;
  productTitle: string;
  productBrand?: string;
  productImage?: string;
  customerName: string;
  orderId?: string | null;
}

export interface RatingCounts {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface RatingBreakdownSummary {
  totalCount: number;
  averageRating: number;
  ratingCounts: RatingCounts;
}

/**
 * Maps raw RPC breakdown rows into zero-filled 5-star counts, total reviews, and average rating.
 */
export function mapBreakdownSummary(rows: RawReviewBreakdownRow[]): RatingBreakdownSummary {
  const ratingCounts: RatingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let totalCount = 0;

  (rows || []).forEach((row) => {
    const star = Math.min(5, Math.max(1, Math.round(Number(row.rating) || 1))) as 1 | 2 | 3 | 4 | 5;
    const count = Math.max(0, Number(row.review_count) || 0);
    ratingCounts[star] = count;
    sum += star * count;
    totalCount += count;
  });

  const averageRating = totalCount > 0 ? Math.round((sum / totalCount) * 10) / 10 : 0;

  return { totalCount, averageRating, ratingCounts };
}

/**
 * Maps a raw RPC review row into the ReviewItemData shape consumed by the UI.
 */
export function mapReviewItem(row: RawSellerReviewRow): ReviewItemData {
  return {
    id: row.id,
    rating: Number(row.rating) || 5,
    review: row.review ?? '',
    createdAt: row.created_at,
    productId: row.product_id,
    productTitle: row.product_title || 'Product',
    customerName: row.customer_name || 'Customer',
    orderId: row.order_id ?? null,
  };
}

