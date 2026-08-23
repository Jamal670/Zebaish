import supabase from './client';

// Phase 1 KPI Response Types
export interface Section1Kpis {
  total_revenue: number;
  available_payout: number;
  active_listings: number;
  pending_dispatch: number;
  delivered_orders: number;
  average_rating: number;
}

export interface Section2Last7d {
  revenue_7d: number;
  orders_7d: number;
  avg_order_value_7d: number;
  pending_fulfillment_7d: number;
  new_reviews_7d: number;
  units_sold_7d: number;
}

export interface SellerOverviewKpisData {
  section1_kpis: Section1Kpis;
  section2_last_7d: Section2Last7d;
}

// Phase 2 Details Response Types
export interface DailyRevenueItem {
  date: string;
  shortDay: string;
  revenue: number;
}

export interface DailyVolumeItem {
  date: string;
  shortDay: string;
  orders_count: number;
}

export interface OrderStatusBreakdownItem {
  status: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled' | string;
  count: number;
}

export interface TopProductSoldItem {
  product_title: string;
  brand: string;
  units_sold: number;
  revenue: number;
}

export interface PaymentMethodShareData {
  cod: number;
  online: number;
  cod_pct: number;
  online_pct: number;
}

export interface RecentOrderItem {
  id: string;
  order_number: string;
  customer_name: string;
  city: string;
  brand: string;
  product_title: string;
  seller_total: number;
  status: string;
  created_at: string;
}

export interface SellerOverviewDetailsData {
  graphs: {
    daily_revenue_trajectory: DailyRevenueItem[];
    daily_order_volume: DailyVolumeItem[];
    order_status_breakdown: OrderStatusBreakdownItem[];
    top_products_sold: TopProductSoldItem[];
    payment_method_share: PaymentMethodShareData;
  };
  recent_orders: RecentOrderItem[];
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Phase 1: Fast, lightweight RPC call returning ONLY Section 1 + Section 2 KPI cards.
 * Resolves first and renders immediately.
 */
export async function fetchSellerOverviewKpis(sellerId: string): Promise<SellerOverviewKpisData> {
  const isUuid = isValidUUID(sellerId);

  if (isUuid) {
    try {
      const { data, error } = await supabase.rpc('get_seller_overview_kpis', {
        p_seller_id: sellerId,
      });

      if (!error && data && data.section1_kpis) {
        const kpiData = data as SellerOverviewKpisData;
        if (kpiData.section1_kpis.average_rating === undefined) {
          const fallbackData = await fetchSellerOverviewKpisFallback(sellerId);
          kpiData.section1_kpis.average_rating = fallbackData.section1_kpis.average_rating;
        }
        return kpiData;
      }
    } catch (e) {
      console.warn('RPC get_seller_overview_kpis unavailable, using direct PostgREST fallback...', e);
    }
  }

  // Client-side PostgREST Fallback (strictly scoped to sellerId)
  return fetchSellerOverviewKpisFallback(sellerId);
}

/**
 * Phase 2: Fetches 5 graphs data + Recent Orders table (LIMIT 3).
 * Rendered into skeleton placeholders after Phase 1.
 */
export async function fetchSellerOverviewDetails(sellerId: string): Promise<SellerOverviewDetailsData> {
  const isUuid = isValidUUID(sellerId);

  if (isUuid) {
    try {
      const { data, error } = await supabase.rpc('get_seller_overview_details', {
        p_seller_id: sellerId,
      });

      if (!error && data && data.graphs) {
        return data as SellerOverviewDetailsData;
      }
    } catch (e) {
      console.warn('RPC get_seller_overview_details unavailable, using direct PostgREST fallback...', e);
    }
  }

  // Client-side PostgREST Fallback (strictly scoped to sellerId)
  return fetchSellerOverviewDetailsFallback(sellerId);
}

// --------------------------------------------------------------------
// POSTGREST FALLBACK IMPLEMENTATIONS (Exact logic match)
// --------------------------------------------------------------------

async function fetchSellerOverviewKpisFallback(sellerId: string): Promise<SellerOverviewKpisData> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // 1. seller_orders for seller
    const { data: sellerOrders } = await supabase
      .from('seller_orders')
      .select('id, seller_total, status, payment_status, created_at, updated_at')
      .eq('seller_id', sellerId);

    // 2. products for seller
    const { data: products } = await supabase
      .from('products')
      .select('id, status')
      .eq('seller_id', sellerId);

    // 3. reviews for seller products (selecting minimum required fields)
    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, rating, status, created_at, products!inner(seller_id)')
      .eq('products.seller_id', sellerId);

    // 4. order_items joined to seller_orders
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, quantity, seller_id, created_at, seller_orders!inner(status, created_at)')
      .eq('seller_id', sellerId);

    const orders = sellerOrders || [];
    const prods = products || [];
    const revs = reviews || [];
    const items = orderItems || [];

    // Section 1 Math
    const totalRev = orders
      .filter((o) => ['Shipped', 'Delivered'].includes(o.status))
      .reduce((acc, o) => acc + (Number(o.seller_total) || 0), 0);

    const availPayout = orders
      .filter((o) => ['Shipped', 'Delivered'].includes(o.status) && o.payment_status === 'Pending')
      .reduce((acc, o) => acc + (Number(o.seller_total) || 0), 0);

    const activeListings = prods.filter((p) => p.status === 'Active').length;

    const pendingDispatch = orders.filter((o) => ['Pending', 'Confirmed'].includes(o.status)).length;

    const deliveredOrders = orders.filter((o) => ['Shipped', 'Delivered'].includes(o.status)).length;

    const approvedReviews = revs.filter((r: any) => !r.status || r.status === 'Approved');
    const approvedReviewsCount = approvedReviews.length;
    const averageRating =
      approvedReviewsCount > 0
        ? Math.round(
          (approvedReviews.reduce((sum: number, r: any) => sum + (Number(r.rating) || 5), 0) /
            approvedReviewsCount) *
          10
        ) / 10
        : 0;

    // Section 2 Math (7 Days window)
    const rev7d = orders
      .filter(
        (o) =>
          ['Shipped', 'Delivered'].includes(o.status) &&
          o.updated_at &&
          new Date(o.updated_at) >= sevenDaysAgo
      )
      .reduce((acc, o) => acc + (Number(o.seller_total) || 0), 0);

    const orders7d = orders.filter(
      (o) => o.status !== 'Cancelled' && new Date(o.created_at) >= sevenDaysAgo
    ).length;

    const orders7dAll = orders.filter((o) => new Date(o.created_at) >= sevenDaysAgo);
    const avgAov7d =
      orders7dAll.length > 0
        ? Math.round(
          orders7dAll.reduce((acc, o) => acc + (Number(o.seller_total) || 0), 0) / orders7dAll.length
        )
        : 0;

    const pending7d = orders.filter(
      (o) => o.status === 'Pending' && new Date(o.created_at) >= sevenDaysAgo
    ).length;

    const newReviews7d = revs.filter((r) => new Date(r.created_at) >= sevenDaysAgo).length;

    const unitsSold7d = items
      .filter((i: any) => {
        const so = Array.isArray(i.seller_orders) ? i.seller_orders[0] : i.seller_orders;
        return (
          ['Shipped', 'Delivered'].includes(so?.status) &&
          new Date(i.created_at) >= sevenDaysAgo
        );
      })
      .reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);

    return {
      section1_kpis: {
        total_revenue: Math.round(totalRev),
        available_payout: Math.round(availPayout),
        active_listings: activeListings,
        pending_dispatch: pendingDispatch,
        delivered_orders: deliveredOrders,
        average_rating: averageRating,
      },
      section2_last_7d: {
        revenue_7d: Math.round(rev7d),
        orders_7d: orders7d,
        avg_order_value_7d: avgAov7d,
        pending_fulfillment_7d: pending7d,
        new_reviews_7d: newReviews7d,
        units_sold_7d: unitsSold7d,
      },
    };
  } catch (err) {
    console.error('Error fetching seller overview KPIs fallback:', err);
    return {
      section1_kpis: { total_revenue: 0, available_payout: 0, active_listings: 0, pending_dispatch: 0, delivered_orders: 0, average_rating: 0 },
      section2_last_7d: { revenue_7d: 0, orders_7d: 0, avg_order_value_7d: 0, pending_fulfillment_7d: 0, new_reviews_7d: 0, units_sold_7d: 0 },
    };
  }
}

async function fetchSellerOverviewDetailsFallback(sellerId: string): Promise<SellerOverviewDetailsData> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // 1. Fetch seller_orders with joined orders & order_items
    const { data: sellerOrders } = await supabase
      .from('seller_orders')
      .select(`
        id,
        order_id,
        seller_id,
        seller_total,
        status,
        created_at,
        orders (
          id,
          order_number,
          customer_name,
          city,
          payment_method
        )
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, order_id, seller_id, product_title, brand, quantity, subtotal, created_at')
      .eq('seller_id', sellerId);

    const ordersList: any[] = sellerOrders || [];
    const itemsList: any[] = orderItems || [];

    // Daily buckets (7 days)
    const dailyRevenue: DailyRevenueItem[] = [];
    const dailyVolume: DailyVolumeItem[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      const shortDay = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

      let dayRev = 0;
      let dayCnt = 0;

      ordersList.forEach((so) => {
        const dt = new Date(so.created_at);
        if (dt >= dayStart && dt <= dayEnd) {
          dayCnt++;
          if (['Shipped', 'Delivered'].includes(so.status)) {
            dayRev += Number(so.seller_total) || 0;
          }
        }
      });

      dailyRevenue.push({ date: dateStr, shortDay, revenue: Math.round(dayRev) });
      dailyVolume.push({ date: dateStr, shortDay, orders_count: dayCnt });
    }

    // Status breakdown (all 5 categories guaranteed)
    const orders7d = ordersList.filter((so) => new Date(so.created_at) >= sevenDaysAgo);
    const statusCounts: Record<string, number> = { Pending: 0, Confirmed: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
    orders7d.forEach((so) => {
      if (statusCounts[so.status] !== undefined) {
        statusCounts[so.status]++;
      }
    });

    const orderStatusBreakdown: OrderStatusBreakdownItem[] = [
      { status: 'Pending', count: statusCounts.Pending },
      { status: 'Confirmed', count: statusCounts.Confirmed },
      { status: 'Shipped', count: statusCounts.Shipped },
      { status: 'Delivered', count: statusCounts.Delivered },
      { status: 'Cancelled', count: statusCounts.Cancelled },
    ];

    // Top 5 products
    const prodMap = new Map<string, { product_title: string; brand: string; units_sold: number; revenue: number }>();
    itemsList.forEach((item) => {
      if (new Date(item.created_at) >= sevenDaysAgo) {
        const key = `${item.brand}_${item.product_title}`;
        const existing = prodMap.get(key) || {
          product_title: item.product_title || 'Surplus Suit',
          brand: item.brand || 'Designer Brand',
          units_sold: 0,
          revenue: 0,
        };
        existing.units_sold += Number(item.quantity) || 1;
        existing.revenue += Number(item.subtotal) || 0;
        prodMap.set(key, existing);
      }
    });

    const topProducts = Array.from(prodMap.values())
      .sort((a, b) => b.units_sold - a.units_sold)
      .slice(0, 5);

    // Payment method share
    let codCnt = 0;
    let onlineCnt = 0;
    orders7d.forEach((so) => {
      const orderObj = Array.isArray(so.orders) ? so.orders[0] : so.orders;
      if (orderObj?.payment_method === 'Online') onlineCnt++;
      else codCnt++;
    });
    const totalPay = codCnt + onlineCnt;

    const paymentMethodShare: PaymentMethodShareData = {
      cod: codCnt,
      online: onlineCnt,
      cod_pct: totalPay > 0 ? Math.round((codCnt / totalPay) * 100) : 0,
      online_pct: totalPay > 0 ? Math.round((onlineCnt / totalPay) * 100) : 0,
    };

    // Recent orders (Limit 3)
    const recent3 = ordersList.slice(0, 3).map((so) => {
      const orderObj = Array.isArray(so.orders) ? so.orders[0] : so.orders;
      const matchingItems = itemsList.filter((i) => i.order_id === so.order_id);
      const primaryBrand = matchingItems[0]?.brand || 'Designer Brand';
      const primaryTitle = matchingItems[0]?.product_title || 'Surplus Suit';
      const titleDisplay = matchingItems.length > 1
        ? `${primaryTitle} (+${matchingItems.length - 1} more)`
        : primaryTitle;

      return {
        id: so.id,
        order_number: orderObj?.order_number || `ORD-${so.id.slice(0, 6)}`,
        customer_name: orderObj?.customer_name || 'Customer',
        city: orderObj?.city || 'Lahore',
        brand: primaryBrand,
        product_title: titleDisplay,
        seller_total: Number(so.seller_total) || 0,
        status: so.status || 'Pending',
        created_at: so.created_at,
      };
    });

    return {
      graphs: {
        daily_revenue_trajectory: dailyRevenue,
        daily_order_volume: dailyVolume,
        order_status_breakdown: orderStatusBreakdown,
        top_products_sold: topProducts,
        payment_method_share: paymentMethodShare,
      },
      recent_orders: recent3,
    };
  } catch (err) {
    console.error('Error fetching seller overview details fallback:', err);
    return {
      graphs: {
        daily_revenue_trajectory: [],
        daily_order_volume: [],
        order_status_breakdown: [
          { status: 'Pending', count: 0 },
          { status: 'Confirmed', count: 0 },
          { status: 'Shipped', count: 0 },
          { status: 'Delivered', count: 0 },
          { status: 'Cancelled', count: 0 },
        ],
        top_products_sold: [],
        payment_method_share: { cod: 0, online: 0, cod_pct: 0, online_pct: 0 },
      },
      recent_orders: [],
    };
  }
}
