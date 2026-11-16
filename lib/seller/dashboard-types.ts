import {
  DailyRevenueItem,
  DailyVolumeItem,
  OrderStatusBreakdownItem,
  PaymentMethodShareData,
  Section2Last7d,
  TopProductSoldItem,
} from '@/src/api/sellerOverviewService';

/**
 * Mirrored from SQL `get_seller_dashboard`:
 * - EXCLUDED_FROM_REVENUE = ('Cancelled', 'Refund')
 * - Window timezone = 'Asia/Karachi'
 */
export const EXCLUDED_FROM_REVENUE = ['Cancelled', 'Refund'] as const;
export const DASHBOARD_TIMEZONE = 'Asia/Karachi' as const;

export const ALL_SELLER_ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Refund',
] as const;

export interface RawDashboardOverview {
  total_revenue: number | string | null;
  pending_dispatch: number | string | null;
  delivered_orders: number | string | null;
  avg_rating: number | string | null;
  active_listings: number | string | null;
  payable_commission: number | string | null;
}

export interface RawDashboardLast7 {
  revenue: number | string | null;
  orders: number | string | null;
  avg_order_value: number | string | null;
  pending_fulfillment: number | string | null;
}

export interface RawDashboardDailyRow {
  date: string;
  revenue: number | string | null;
  orders: number | string | null;
}

export interface RawDashboardRecentOrder {
  id: string;
  status: string;
  seller_total: number | string | null;
  payment_method: string | null;
  created_at: string;
  dispatch_deadline: string | null;
  order_number: string;
  customer_name: string;
  city?: string | null;
  brand?: string | null;
  product_title?: string | null;
}

export interface SellerDashboardRpcResponse {
  overview: RawDashboardOverview;
  last7: RawDashboardLast7;
  daily: RawDashboardDailyRow[];
  status_breakdown: Record<string, number | string | null>;
  recent_orders: RawDashboardRecentOrder[];
}

export interface DashboardOverviewMetrics {
  totalRevenue: number;
  payableCommission: number;
  activeListings: number;
  pendingDispatch: number;
  deliveredOrders: number;
  avgRating: number;
}

export interface RecentDashboardOrder {
  id: string;
  order_number: string;
  customer_name: string;
  city: string;
  brand: string;
  product_title: string;
  seller_total: number;
  status: string;
  payment_method: string;
  created_at: string;
  dispatch_deadline: string | null;
}

export interface SellerDashboardData {
  overview: DashboardOverviewMetrics;
  last7Kpis: Section2Last7d;
  graphs: {
    daily_revenue_trajectory: DailyRevenueItem[];
    daily_order_volume: DailyVolumeItem[];
    order_status_breakdown: OrderStatusBreakdownItem[];
    top_products_sold: TopProductSoldItem[];
    payment_method_share: PaymentMethodShareData;
  };
  recentOrders: RecentDashboardOrder[];
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function round2(value: unknown): number {
  const num = toFiniteNumber(value, 0);
  return Math.round(num * 100) / 100;
}

function toNonNegativeInt(value: unknown): number {
  const num = toFiniteNumber(value, 0);
  return num > 0 ? Math.floor(num) : 0;
}

const dateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  timeZone: DASHBOARD_TIMEZONE,
});

const shortDayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: DASHBOARD_TIMEZONE,
});

/**
 * Formats an ISO calendar date string (e.g. '2026-11-12') in Asia/Karachi
 * without shifting days across UTC/local browser timezones.
 */
export function formatDashboardDayLabels(isoDate: string): { date: string; shortDay: string } {
  const trimmed = (isoDate || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) {
    return { date: trimmed || '—', shortDay: '—' };
  }
  const anchor = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00+05:00`);
  if (Number.isNaN(anchor.getTime())) {
    return { date: trimmed, shortDay: trimmed };
  }
  return {
    date: dateLabelFormatter.format(anchor),
    shortDay: shortDayFormatter.format(anchor),
  };
}

export function mapSellerDashboardData(raw: SellerDashboardRpcResponse | null): SellerDashboardData {
  const ov = raw?.overview;
  const l7 = raw?.last7;
  const rawDaily = Array.isArray(raw?.daily) ? raw.daily : [];
  const rawStatus = raw?.status_breakdown || {};
  const rawRecent = Array.isArray(raw?.recent_orders) ? raw.recent_orders : [];

  const dailyRevenue: DailyRevenueItem[] = [];
  const dailyVolume: DailyVolumeItem[] = [];

  for (const row of rawDaily) {
    const { date, shortDay } = formatDashboardDayLabels(row?.date);
    dailyRevenue.push({
      date,
      shortDay,
      revenue: round2(row?.revenue),
    });
    dailyVolume.push({
      date,
      shortDay,
      orders_count: toNonNegativeInt(row?.orders),
    });
  }

  const orderStatusBreakdown: OrderStatusBreakdownItem[] = ALL_SELLER_ORDER_STATUSES.map((status) => ({
    status,
    count: toNonNegativeInt(rawStatus[status]),
  }));

  const recentOrders: RecentDashboardOrder[] = rawRecent.slice(0, 3).map((r) => ({
    id: r.id,
    order_number: r.order_number || '—',
    customer_name: r.customer_name || 'Customer',
    city: r.city?.trim() || '—',
    brand: r.brand?.trim() || '—',
    product_title: r.product_title?.trim() || '—',
    seller_total: round2(r.seller_total),
    status: r.status || 'Pending',
    payment_method: r.payment_method || '',
    created_at: r.created_at,
    dispatch_deadline: r.dispatch_deadline ?? null,
  }));

  const rawRating = toFiniteNumber(ov?.avg_rating, 0);

  return {
    overview: {
      totalRevenue: round2(ov?.total_revenue),
      payableCommission: round2(ov?.payable_commission),
      activeListings: toNonNegativeInt(ov?.active_listings),
      pendingDispatch: toNonNegativeInt(ov?.pending_dispatch),
      deliveredOrders: toNonNegativeInt(ov?.delivered_orders),
      avgRating: Math.round(Math.max(0, Math.min(5, rawRating)) * 10) / 10,
    },
    last7Kpis: {
      revenue_7d: round2(l7?.revenue),
      orders_7d: toNonNegativeInt(l7?.orders),
      avg_order_value_7d: round2(l7?.avg_order_value),
      pending_fulfillment_7d: toNonNegativeInt(l7?.pending_fulfillment),
      // TODO: wire real 7-day reviews count when backend metric is added
      new_reviews_7d: 0,
      // TODO: wire real 7-day units sold when backend metric is added
      units_sold_7d: 0,
    },
    graphs: {
      daily_revenue_trajectory: dailyRevenue,
      daily_order_volume: dailyVolume,
      order_status_breakdown: orderStatusBreakdown,
      top_products_sold: [],
      payment_method_share: { cod: 0, online: 0, cod_pct: 0, online_pct: 0 },
    },
    recentOrders,
  };
}

