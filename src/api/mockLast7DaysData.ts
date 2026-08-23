export interface DailyPerformanceItem {
  date: string;
  shortDay: string;
  revenue: number;
  orders_count: number;
  units_sold: number;
  order_status: {
    pending: number;
    confirmed: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
  payment_method: {
    cod: number;
    online: number;
  };
}

export interface TopProductSold {
  product_title: string;
  brand: string;
  units_sold: number;
  revenue: number;
}

export interface Last7DaysDataResponse {
  dateRangeLabel: string;
  dailyData: DailyPerformanceItem[];
  totals: {
    total_revenue: number;
    total_orders: number;
    total_units_sold: number;
    average_order_value: number;
    revenue_trend_pct: number;
    orders_trend_pct: number;
    previous_7_days_revenue: number;
    previous_7_days_orders: number;
  };
  pending_fulfillment_count: number;
  reviews_summary: {
    new_reviews_count: number;
    average_rating: number;
  };
  top_5_products: TopProductSold[];
  aggregated_status: {
    delivered: number;
    shipped: number;
    processing: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  };
  aggregated_payment: {
    cod: number;
    online: number;
    cod_pct: number;
    online_pct: number;
  };
  best_day: {
    day: string;
    revenue: number;
  };
  worst_day: {
    day: string;
    revenue: number;
  };
}

/**
 * Realistic 7 days mock data (Mon-Sun) for seller dashboard.
 * Includes Fri as "Best Day" and Sun as "Worst/Zero Day".
 */
const MOCK_7_DAYS_DATA: Last7DaysDataResponse = {
  dateRangeLabel: 'Jul 23 - Jul 29, 2026',
  dailyData: [
    {
      date: 'Mon, Jul 23',
      shortDay: 'Mon',
      revenue: 145000,
      orders_count: 12,
      units_sold: 18,
      order_status: { pending: 1, confirmed: 2, processing: 3, shipped: 2, delivered: 4, cancelled: 0 },
      payment_method: { cod: 8, online: 4 },
    },
    {
      date: 'Tue, Jul 24',
      shortDay: 'Tue',
      revenue: 210000,
      orders_count: 18,
      units_sold: 25,
      order_status: { pending: 1, confirmed: 2, processing: 4, shipped: 3, delivered: 7, cancelled: 1 },
      payment_method: { cod: 11, online: 7 },
    },
    {
      date: 'Wed, Jul 25',
      shortDay: 'Wed',
      revenue: 180000,
      orders_count: 15,
      units_sold: 20,
      order_status: { pending: 0, confirmed: 1, processing: 3, shipped: 4, delivered: 6, cancelled: 1 },
      payment_method: { cod: 9, online: 6 },
    },
    {
      date: 'Thu, Jul 26',
      shortDay: 'Thu',
      revenue: 290000,
      orders_count: 24,
      units_sold: 35,
      order_status: { pending: 1, confirmed: 3, processing: 5, shipped: 5, delivered: 9, cancelled: 1 },
      payment_method: { cod: 15, online: 9 },
    },
    {
      date: 'Fri, Jul 27',
      shortDay: 'Fri',
      revenue: 380000, // BEST DAY
      orders_count: 32,
      units_sold: 48,
      order_status: { pending: 2, confirmed: 4, processing: 6, shipped: 6, delivered: 13, cancelled: 1 },
      payment_method: { cod: 20, online: 12 },
    },
    {
      date: 'Sat, Jul 28',
      shortDay: 'Sat',
      revenue: 320000,
      orders_count: 26,
      units_sold: 38,
      order_status: { pending: 1, confirmed: 3, processing: 5, shipped: 4, delivered: 12, cancelled: 1 },
      payment_method: { cod: 16, online: 10 },
    },
    {
      date: 'Sun, Jul 29',
      shortDay: 'Sun',
      revenue: 0, // WORST DAY / ZERO STATE
      orders_count: 0,
      units_sold: 0,
      order_status: { pending: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
      payment_method: { cod: 0, online: 0 },
    },
  ],
  totals: {
    total_revenue: 1525000,
    total_orders: 127,
    total_units_sold: 184,
    average_order_value: 12008,
    revenue_trend_pct: 14.2,
    orders_trend_pct: 8.5,
    previous_7_days_revenue: 1335000,
    previous_7_days_orders: 117,
  },
  pending_fulfillment_count: 18,
  reviews_summary: {
    new_reviews_count: 14,
    average_rating: 4.6,
  },
  top_5_products: [
    { product_title: 'Khaadi 3PC Embroidered Lawn', brand: 'Khaadi', units_sold: 42, revenue: 378000 },
    { product_title: 'Sapphire Luxury Velvet Suit', brand: 'Sapphire', units_sold: 35, revenue: 350000 },
    { product_title: 'Maria B M-Prints Unstitched', brand: 'Maria B', units_sold: 28, revenue: 252000 },
    { product_title: 'Gul Ahmed Festive Chiffon', brand: 'Gul Ahmed', units_sold: 22, revenue: 198000 },
    { product_title: 'Sana Safinaz Nawaab Silk 3PC', brand: 'Sana Safinaz', units_sold: 18, revenue: 180000 },
  ],
  aggregated_status: {
    delivered: 51,
    shipped: 23,
    processing: 26,
    confirmed: 15,
    pending: 6,
    cancelled: 5,
  },
  aggregated_payment: {
    cod: 79,
    online: 48,
    cod_pct: 62,
    online_pct: 38,
  },
  best_day: {
    day: 'Fri, Jul 27',
    revenue: 380000,
  },
  worst_day: {
    day: 'Sun, Jul 29',
    revenue: 0,
  },
};

/**
 * Wrapped mock data fetcher function simulating ~500ms async API call.
 * Easily swappable with real Supabase API in future.
 */
export async function getLast7DaysData(): Promise<Last7DaysDataResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_7_DAYS_DATA);
    }, 500);
  });
}
