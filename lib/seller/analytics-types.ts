/**
 * TypeScript types and data transformers for seller analytics queries
 */

export interface RawAnalyticsKpis {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  pending_fulfillment: number;
  cancelled_orders: number;
  active_listings: number;
  sold_out_products: number;
  avg_rating: number;
  approved_reviews_count: number;
}

export interface SellerAnalyticsKpis {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  cancellationRate: number;
  activeProductsCount: number;
  soldOutProductsCount: number;
  averageRating: number;
  approvedReviewsCount: number;
}

export interface RevenueTrendPoint {
  bucketStart: string;
  date: string;
  cod: number;
  advancedFull: number;
  revenue: number;
}

export interface RevenueByCityPoint {
  city: string;
  revenue: number;
  orders: number;
}

export interface PaymentShare {
  cod: number;
  online: number;
  total: number;
  codPct: number;
  onlinePct: number;
}

export interface PaymentSharePoint {
  name: string;
  value: number;
  count: number;
  amount: number;
  color: string;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function mapRevenueTrend(raw: unknown, isAllRange = false): RevenueTrendPoint[] {
  if (!Array.isArray(raw)) return [];
  const formatter5Day = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short' });
  const formatterMonth = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Karachi', month: 'short', year: 'numeric' });

  return raw
    .map((r: any) => {
      const bucketStart = String(r?.bucket_start ?? '');
      const cod = num(r?.cod);
      const advancedFull = num(r?.advanced_full);
      const revenue = cod + advancedFull;

      let label = bucketStart;
      if (bucketStart) {
        const parts = bucketStart.split('-').map(Number);
        if (parts.length === 3) {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          label = isAllRange ? formatterMonth.format(d) : formatter5Day.format(d);
        }
      }

      return {
        bucketStart,
        date: label,
        cod,
        advancedFull,
        revenue,
      };
    })
    .filter((p) => p.bucketStart);
}

export function mapPaymentShare(raw: unknown): PaymentShare {
  const rows = Array.isArray(raw) ? (raw as any[]) : [];
  const get = (t: string) => num(rows.find((r) => r?.payment_type === t)?.order_count);
  const cod = get('COD');
  const online = get('Online');
  const total = cod + online;
  const codPct = total > 0 ? Math.round((cod / total) * 100) : 0;
  const onlinePct = total > 0 ? 100 - codPct : 0;
  return { cod, online, total, codPct, onlinePct };
}

/**
 * Calculates safe cancellation rate avoiding division by zero
 */
export function computeCancellationRate(cancelled: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Number(((cancelled / total) * 100).toFixed(1));
}

/**
 * Maps raw KPI RPC response to UI KPI model
 */
export function mapRawKpis(raw: RawAnalyticsKpis | null | undefined): SellerAnalyticsKpis {
  if (!raw) {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      pendingOrdersCount: 0,
      cancelledOrdersCount: 0,
      cancellationRate: 0,
      activeProductsCount: 0,
      soldOutProductsCount: 0,
      averageRating: 0,
      approvedReviewsCount: 0,
    };
  }

  const totalOrders = Number(raw.total_orders) || 0;
  const cancelledOrders = Number(raw.cancelled_orders) || 0;

  return {
    totalRevenue: Number(raw.total_revenue) || 0,
    totalOrders,
    averageOrderValue: Number(raw.avg_order_value) || 0,
    pendingOrdersCount: Number(raw.pending_fulfillment) || 0,
    cancelledOrdersCount: cancelledOrders,
    cancellationRate: computeCancellationRate(cancelledOrders, totalOrders),
    activeProductsCount: Number(raw.active_listings) || 0,
    soldOutProductsCount: Number(raw.sold_out_products) || 0,
    averageRating: Number(raw.avg_rating) || 0,
    approvedReviewsCount: Number(raw.approved_reviews_count) || 0,
  };
}

const DEFAULT_CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Multan'];

/**
 * Ensures 6 city entries exist with proper sorting and fallback cities
 */
export function formatTopCities(items: (RevenueByCityPoint | { city?: string; revenue?: number; order_count?: number; orders?: number })[] | null | undefined): RevenueByCityPoint[] {
  const actualItems: RevenueByCityPoint[] = (items || []).map((item) => ({
    city: item.city || 'Unknown',
    revenue: Number(item.revenue) || 0,
    orders: Number((item as any).order_count ?? item.orders) || 0,
  }));

  actualItems.sort((a, b) => b.revenue - a.revenue);

  if (actualItems.length >= 6) {
    return actualItems.slice(0, 6);
  }

  const existingCityNames = new Set(actualItems.map((c) => c.city.toLowerCase()));
  const result = [...actualItems];

  for (const defaultCity of DEFAULT_CITIES) {
    if (result.length >= 6) break;
    if (!existingCityNames.has(defaultCity.toLowerCase())) {
      result.push({
        city: defaultCity,
        revenue: 0,
        orders: 0,
      });
      existingCityNames.add(defaultCity.toLowerCase());
    }
  }

  return result;
}
