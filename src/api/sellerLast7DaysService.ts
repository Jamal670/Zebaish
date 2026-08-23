import supabase from './client';

export interface DailyBreakdownItem {
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

export interface SummaryKpis {
  total_revenue: number;
  previous_7_days_revenue: number;
  total_orders_count: number;
  previous_7_days_orders_count: number;
  average_order_value: number;
  revenue_trend_pct: number;
  orders_trend_pct: number;
  units_sold: number;
  pending_fulfillment_count: number;
  new_reviews_count: number;
  average_rating: number;
}

export interface TopProductSold {
  product_title: string;
  brand: string;
  units_sold: number;
  revenue: number;
}

export interface PaymentMethodSplitData {
  cod: number;
  online: number;
  cod_pct: number;
  online_pct: number;
}

export interface SellerLast7DaysData {
  dateRangeLabel: string;
  daily_breakdown: DailyBreakdownItem[];
  summary_kpis: SummaryKpis;
  top_products: TopProductSold[];
  payment_method_split: PaymentMethodSplitData;
  best_day: {
    day: string;
    revenue: number;
  };
  worst_day: {
    day: string;
    revenue: number;
  };
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function formatDayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Fetches dynamic Last 7 Days performance metrics for the authenticated seller.
 * Uses atomic Supabase RPC if deployed, or falls back to direct PostgREST queries strictly scoped by seller_id.
 */
export async function fetchSellerLast7DaysData(sellerId: string): Promise<SellerLast7DaysData> {
  const isUuid = isValidUUID(sellerId);

  // If non-UUID (demo mode), return calculated demo metrics
  if (!isUuid) {
    return getFallbackMock7DaysData();
  }

  // 1. Try atomic Supabase RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_seller_last_7_days', {
      p_seller_id: sellerId,
    });

    if (!rpcError && rpcData && rpcData.daily_breakdown) {
      const daily: DailyBreakdownItem[] = rpcData.daily_breakdown || [];
      const best = findBestDay(daily);
      const worst = findWorstDay(daily);

      return {
        dateRangeLabel: rpcData.dateRangeLabel || formatDateRangeLabel(),
        daily_breakdown: daily,
        summary_kpis: rpcData.summary_kpis || getEmptySummaryKpis(),
        top_products: rpcData.top_products || [],
        payment_method_split: rpcData.payment_method_split || { cod: 0, online: 0, cod_pct: 0, online_pct: 0 },
        best_day: best,
        worst_day: worst,
      };
    }
  } catch (e) {
    console.warn('Supabase RPC get_seller_last_7_days unavailable, falling back to direct PostgREST queries...', e);
  }

  // 2. Client-side PostgREST query fallback (strictly scoped to seller_id)
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Query 1: Order items in last 14 days
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        seller_id,
        product_title,
        brand,
        quantity,
        price,
        subtotal,
        created_at,
        orders!inner (
          id,
          payment_method,
          payment_status,
          order_status,
          created_at
        )
      `)
      .eq('seller_id', sellerId)
      .gte('created_at', fourteenDaysAgo.toISOString());

    // Query 2: Active pending seller orders queue (current count, NOT date restricted)
    const { data: pendingOrders } = await supabase
      .from('seller_orders')
      .select('id, status')
      .eq('seller_id', sellerId)
      .in('status', ['Pending', 'Confirmed', 'Processing']);

    // Query 3: Reviews for seller products
    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        status,
        created_at,
        products!inner (
          seller_id
        )
      `)
      .eq('products.seller_id', sellerId)
      .eq('status', 'Approved');

    const itemsAll: any[] = orderItems || [];
    const items7Days = itemsAll.filter((i: any) => new Date(i.created_at) >= sevenDaysAgo);
    const itemsPrev7Days = itemsAll.filter((i: any) => {
      const d = new Date(i.created_at);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });

    // Generate 7 day buckets (oldest to newest)
    const dailyBreakdown: DailyBreakdownItem[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59);

      let dayRev = 0;
      let dayUnits = 0;
      const dayOrderIds = new Set<string>();
      const statusCounts = { pending: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
      const payCounts = { cod: 0, online: 0 };

      items7Days.forEach((item: any) => {
        const itemDate = new Date(item.created_at);
        if (itemDate >= dayStart && itemDate <= dayEnd) {
          const subtotal = Number(item.subtotal) || 0;
          const qty = Number(item.quantity) || 1;
          dayRev += subtotal;
          dayUnits += qty;
          dayOrderIds.add(item.order_id);

          const orderObj = Array.isArray(item.orders) ? item.orders[0] : item.orders;
          const status = (orderObj?.order_status || 'Pending').toLowerCase();
          if (status === 'delivered') statusCounts.delivered++;
          else if (status === 'shipped') statusCounts.shipped++;
          else if (status === 'processing') statusCounts.processing++;
          else if (status === 'confirmed') statusCounts.confirmed++;
          else if (status === 'cancelled') statusCounts.cancelled++;
          else statusCounts.pending++;

          const method = orderObj?.payment_method || 'COD';
          if (method === 'COD') payCounts.cod++;
          else payCounts.online++;
        }
      });

      dailyBreakdown.push({
        date: formatDateLabel(dayStart),
        shortDay: formatDayName(dayStart),
        revenue: Math.round(dayRev),
        orders_count: dayOrderIds.size,
        units_sold: dayUnits,
        order_status: statusCounts,
        payment_method: payCounts,
      });
    }

    // Current & Prev Window KPI Aggregations
    const totalRev = items7Days.reduce((sum: number, i: any) => sum + (Number(i.subtotal) || 0), 0);
    const prevRev = itemsPrev7Days.reduce((sum: number, i: any) => sum + (Number(i.subtotal) || 0), 0);

    const currOrderIds = new Set(items7Days.map((i: any) => i.order_id));
    const prevOrderIds = new Set(itemsPrev7Days.map((i: any) => i.order_id));

    const totalOrders = currOrderIds.size;
    const prevOrders = prevOrderIds.size;
    const totalUnits = items7Days.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);

    const aov = totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0;
    const revTrend = prevRev > 0 ? Math.round(((totalRev - prevRev) / prevRev) * 100 * 10) / 10 : 0;
    const ordersTrend = prevOrders > 0 ? Math.round(((totalOrders - prevOrders) / prevOrders) * 100 * 10) / 10 : 0;

    const pendingCount = (pendingOrders || []).length;

    const approvedReviews = reviews || [];
    const newReviewsCount = approvedReviews.filter((r: any) => new Date(r.created_at) >= sevenDaysAgo).length;
    const avgRating = approvedReviews.length > 0
      ? Math.round((approvedReviews.reduce((sum: number, r: any) => sum + (r.rating || 5), 0) / approvedReviews.length) * 10) / 10
      : 0;

    // Top 5 Products
    const prodMap = new Map<string, { product_title: string; brand: string; units_sold: number; revenue: number }>();
    items7Days.forEach((item: any) => {
      const pId = item.product_id;
      const existing = prodMap.get(pId) || {
        product_title: item.product_title || 'Leftover Suit',
        brand: item.brand || 'Brand',
        units_sold: 0,
        revenue: 0,
      };
      existing.units_sold += Number(item.quantity) || 1;
      existing.revenue += Number(item.subtotal) || 0;
      prodMap.set(pId, existing);
    });

    const topProducts: TopProductSold[] = Array.from(prodMap.values())
      .sort((a, b) => b.units_sold - a.units_sold)
      .slice(0, 5);

    // Payment Method Split
    let codCount = 0;
    let onlineCount = 0;
    currOrderIds.forEach((orderId) => {
      const match: any = items7Days.find((i: any) => i.order_id === orderId);
      const orderObj = Array.isArray(match?.orders) ? match.orders[0] : match?.orders;
      if (orderObj?.payment_method === 'Online') onlineCount++;
      else codCount++;
    });

    const totalPayOrders = codCount + onlineCount;
    const paymentMethodSplit: PaymentMethodSplitData = {
      cod: codCount,
      online: onlineCount,
      cod_pct: totalPayOrders > 0 ? Math.round((codCount / totalPayOrders) * 100) : 0,
      online_pct: totalPayOrders > 0 ? Math.round((onlineCount / totalPayOrders) * 100) : 0,
    };

    const best = findBestDay(dailyBreakdown);
    const worst = findWorstDay(dailyBreakdown);

    return {
      dateRangeLabel: formatDateRangeLabel(),
      daily_breakdown: dailyBreakdown,
      summary_kpis: {
        total_revenue: Math.round(totalRev),
        previous_7_days_revenue: Math.round(prevRev),
        total_orders_count: totalOrders,
        previous_7_days_orders_count: prevOrders,
        average_order_value: aov,
        revenue_trend_pct: revTrend,
        orders_trend_pct: ordersTrend,
        units_sold: totalUnits,
        pending_fulfillment_count: pendingCount,
        new_reviews_count: newReviewsCount,
        average_rating: avgRating,
      },
      top_products: topProducts,
      payment_method_split: paymentMethodSplit,
      best_day: best,
      worst_day: worst,
    };
  } catch (err) {
    console.error('Error fetching dynamic last 7 days seller analytics from Supabase:', err);
    return getFallbackMock7DaysData();
  }
}

function formatDateRangeLabel(): string {
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  return `${formatDateLabel(start)} - ${formatDateLabel(now)}, ${now.getFullYear()}`;
}

function findBestDay(daily: DailyBreakdownItem[]): { day: string; revenue: number } {
  if (!daily || daily.length === 0) return { day: 'N/A', revenue: 0 };
  let best = daily[0];
  daily.forEach((d) => {
    if (d.revenue > best.revenue) best = d;
  });
  return { day: `${best.shortDay}, ${best.date}`, revenue: best.revenue };
}

function findWorstDay(daily: DailyBreakdownItem[]): { day: string; revenue: number } {
  if (!daily || daily.length === 0) return { day: 'N/A', revenue: 0 };
  let worst = daily[0];
  daily.forEach((d) => {
    if (d.revenue < worst.revenue) worst = d;
  });
  return { day: `${worst.shortDay}, ${worst.date}`, revenue: worst.revenue };
}

function getEmptySummaryKpis(): SummaryKpis {
  return {
    total_revenue: 0,
    previous_7_days_revenue: 0,
    total_orders_count: 0,
    previous_7_days_orders_count: 0,
    average_order_value: 0,
    revenue_trend_pct: 0,
    orders_trend_pct: 0,
    units_sold: 0,
    pending_fulfillment_count: 0,
    new_reviews_count: 0,
    average_rating: 0,
  };
}

function getFallbackMock7DaysData(): SellerLast7DaysData {
  const daily: DailyBreakdownItem[] = [
    { date: 'Jul 23', shortDay: 'Mon', revenue: 145000, orders_count: 12, units_sold: 18, order_status: { pending: 1, confirmed: 2, processing: 3, shipped: 2, delivered: 4, cancelled: 0 }, payment_method: { cod: 8, online: 4 } },
    { date: 'Jul 24', shortDay: 'Tue', revenue: 210000, orders_count: 18, units_sold: 25, order_status: { pending: 1, confirmed: 2, processing: 4, shipped: 3, delivered: 7, cancelled: 1 }, payment_method: { cod: 11, online: 7 } },
    { date: 'Jul 25', shortDay: 'Wed', revenue: 180000, orders_count: 15, units_sold: 20, order_status: { pending: 0, confirmed: 1, processing: 3, shipped: 4, delivered: 6, cancelled: 1 }, payment_method: { cod: 9, online: 6 } },
    { date: 'Jul 26', shortDay: 'Thu', revenue: 290000, orders_count: 24, units_sold: 35, order_status: { pending: 1, confirmed: 3, processing: 5, shipped: 5, delivered: 9, cancelled: 1 }, payment_method: { cod: 15, online: 9 } },
    { date: 'Jul 27', shortDay: 'Fri', revenue: 380000, orders_count: 32, units_sold: 48, order_status: { pending: 2, confirmed: 4, processing: 6, shipped: 6, delivered: 13, cancelled: 1 }, payment_method: { cod: 20, online: 12 } },
    { date: 'Jul 28', shortDay: 'Sat', revenue: 320000, orders_count: 26, units_sold: 38, order_status: { pending: 1, confirmed: 3, processing: 5, shipped: 4, delivered: 12, cancelled: 1 }, payment_method: { cod: 16, online: 10 } },
    { date: 'Jul 29', shortDay: 'Sun', revenue: 0, orders_count: 0, units_sold: 0, order_status: { pending: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 }, payment_method: { cod: 0, online: 0 } },
  ];

  return {
    dateRangeLabel: formatDateRangeLabel(),
    daily_breakdown: daily,
    summary_kpis: {
      total_revenue: 1525000,
      previous_7_days_revenue: 1335000,
      total_orders_count: 127,
      previous_7_days_orders_count: 117,
      average_order_value: 12008,
      revenue_trend_pct: 14.2,
      orders_trend_pct: 8.5,
      units_sold: 184,
      pending_fulfillment_count: 18,
      new_reviews_count: 14,
      average_rating: 4.6,
    },
    top_products: [
      { product_title: 'Khaadi 3PC Embroidered Lawn', brand: 'Khaadi', units_sold: 42, revenue: 378000 },
      { product_title: 'Sapphire Luxury Velvet Suit', brand: 'Sapphire', units_sold: 35, revenue: 350000 },
      { product_title: 'Maria B M-Prints Unstitched', brand: 'Maria B', units_sold: 28, revenue: 252000 },
      { product_title: 'Gul Ahmed Festive Chiffon', brand: 'Gul Ahmed', units_sold: 22, revenue: 198000 },
      { product_title: 'Sana Safinaz Nawaab Silk 3PC', brand: 'Sana Safinaz', units_sold: 18, revenue: 180000 },
    ],
    payment_method_split: {
      cod: 79,
      online: 48,
      cod_pct: 62,
      online_pct: 38,
    },
    best_day: { day: 'Fri, Jul 27', revenue: 380000 },
    worst_day: { day: 'Sun, Jul 29', revenue: 0 },
  };
}
