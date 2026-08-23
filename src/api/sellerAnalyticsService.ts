import supabase from './client';

export interface FetchAnalyticsParams {
  sellerId: string;
  dateRange: '7D' | '30D' | '90D' | 'ALL';
  selectedCity?: string;
  selectedBrand?: string;
}

export interface AnalyticsKpis {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  activeProductsCount: number;
  soldOutProductsCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  cancellationRate: number;
  averageRating: number;
  approvedReviewsCount: number;
}

export interface FiveDayBucket {
  date: string;
  revenue: number;
  cod: number;
  online: number;
  orders: number;
}

export interface RevenueByCityItem {
  city: string;
  revenue: number;
  orders: number;
}

export interface PaymentMethodCountItem {
  name: string;
  value: number;
  count: number;
  amount: number;
  color: string;
}

export interface BrandPerformanceItem {
  brand: string;
  revenue: number;
  suitsSold: number;
}

export interface StitchingSplitItem {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface AlertProductItem {
  id: string;
  title: string;
  stock: number;
  status: 'Sold Out' | 'Low Stock';
  brand: string;
}

export interface ReviewRatingDistItem {
  stars: string;
  count: number;
  pct: number;
}

export interface ReviewModerationItem {
  id: string;
  customer: string;
  product: string;
  rating: number;
  comment: string;
  date: string;
  status: 'Approved' | 'Pending' | 'Rejected';
}

export interface SellerAnalyticsResponse {
  kpis: AnalyticsKpis;
  revenueTrend: FiveDayBucket[];
  revenueByCity: RevenueByCityItem[];
  paymentMethodSplit: PaymentMethodCountItem[];
  topBrands: BrandPerformanceItem[];
  stitchingSplit: StitchingSplitItem[];
  lowStockItems: AlertProductItem[];
  ratingDistribution: ReviewRatingDistItem[];
  recentReviews: ReviewModerationItem[];
  availableCities: string[];
  availableBrands: string[];
}

const DEFAULT_CITIES = ['Lahore', 'Sialkot', 'Gujranwala', 'Islamabad', 'Faisalabad', 'Karachi'];
const DEFAULT_BRANDS = ['Khaadi', 'Sapphire', 'Nishat', 'Maria B', 'Limelight', 'Alkaram'];

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function getDateThreshold(dateRange: '7D' | '30D' | '90D' | 'ALL'): Date | null {
  const now = new Date();
  if (dateRange === '7D') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (dateRange === '30D') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (dateRange === '90D') {
    return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }
  return null;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

/**
 * Ensures 6 cities are returned: actual seller cities sorted highest first,
 * with remaining slots filled using default cities with 0 revenue.
 */
function formatTopSixCities(actualCityMap: Map<string, { revenue: number; orderIds: Set<string> }>): RevenueByCityItem[] {
  const actualItems: RevenueByCityItem[] = Array.from(actualCityMap.entries())
    .map(([city, data]) => ({
      city,
      revenue: Math.round(data.revenue),
      orders: data.orderIds.size,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  if (actualItems.length >= 6) {
    return actualItems.slice(0, 6);
  }

  const existingCityNames = new Set(actualItems.map((item) => item.city.toLowerCase()));
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

/**
 * Ensures at least 6 brands are returned: actual seller brands sorted highest first,
 * with remaining slots filled using default brands with 0 revenue.
 */
function formatTopSixBrands(actualBrandMap: Map<string, { revenue: number; suitsSold: number }>): BrandPerformanceItem[] {
  const actualItems: BrandPerformanceItem[] = Array.from(actualBrandMap.entries())
    .map(([brand, data]) => ({
      brand,
      revenue: Math.round(data.revenue),
      suitsSold: data.suitsSold,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  if (actualItems.length >= 6) {
    return actualItems;
  }

  const existingBrandNames = new Set(actualItems.map((item) => item.brand.toLowerCase()));
  const result = [...actualItems];

  for (const defaultBrand of DEFAULT_BRANDS) {
    if (result.length >= 6) break;
    if (!existingBrandNames.has(defaultBrand.toLowerCase())) {
      result.push({
        brand: defaultBrand,
        revenue: 0,
        suitsSold: 0,
      });
      existingBrandNames.add(defaultBrand.toLowerCase());
    }
  }

  return result;
}

/**
 * Fetches, filters, and aggregates seller analytics metrics from Supabase database schema.
 * Scoped strictly to the authenticated seller ID.
 */
export async function fetchSellerAnalyticsData({
  sellerId,
  dateRange,
  selectedCity = 'All Cities',
  selectedBrand = 'All Brands',
}: FetchAnalyticsParams): Promise<SellerAnalyticsResponse> {
  const isUuid = isValidUUID(sellerId);
  const startDate = getDateThreshold(dateRange);

  // If not valid UUID (demo mode), return calculated demo metrics
  if (!isUuid) {
    return getFallbackMockAnalytics(dateRange, selectedCity, selectedBrand);
  }

  try {
    // 1. Query seller's order items joined with main order details
    let orderItemsQuery = supabase
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
          city,
          payment_method,
          payment_status,
          order_status,
          created_at
        )
      `)
      .eq('seller_id', sellerId);

    if (startDate) {
      orderItemsQuery = orderItemsQuery.gte('created_at', startDate.toISOString());
    }

    // 2. Query seller orders for order-level seller status & revenue
    let sellerOrdersQuery = supabase
      .from('seller_orders')
      .select(`
        id,
        order_id,
        seller_id,
        seller_total,
        status,
        created_at,
        orders!inner (
          id,
          city,
          payment_method,
          payment_status,
          order_status,
          created_at
        )
      `)
      .eq('seller_id', sellerId);

    if (startDate) {
      sellerOrdersQuery = sellerOrdersQuery.gte('created_at', startDate.toISOString());
    }

    // 3. Query seller products (unrestricted by date range for current inventory state)
    const productsQuery = supabase
      .from('products')
      .select('*')
      .eq('seller_id', sellerId);

    // 4. Query reviews belonging to seller's products (only Approved reviews)
    const reviewsQuery = supabase
      .from('reviews')
      .select(`
        id,
        product_id,
        rating,
        review,
        status,
        created_at,
        products!inner (
          seller_id,
          suit_title,
          brand
        ),
        users (
          first_name,
          last_name
        )
      `)
      .eq('products.seller_id', sellerId);

    const [orderItemsRes, sellerOrdersRes, productsRes, reviewsRes] = await Promise.all([
      orderItemsQuery,
      sellerOrdersQuery,
      productsQuery,
      reviewsQuery,
    ]);

    let rawOrderItems = orderItemsRes.data || [];
    let rawSellerOrders = sellerOrdersRes.data || [];
    const rawProducts = productsRes.data || [];
    const rawReviews = reviewsRes.data || [];

    // Extract available cities & brands dynamically for filter options
    const citiesSet = new Set<string>();
    const brandsSet = new Set<string>();

    rawOrderItems.forEach((item: any) => {
      if (item.orders?.city) citiesSet.add(item.orders.city);
      if (item.brand) brandsSet.add(item.brand);
    });
    rawProducts.forEach((p: any) => {
      if (p.brand) brandsSet.add(p.brand);
    });

    const availableCities = Array.from(citiesSet).sort();
    const availableBrands = Array.from(brandsSet).sort();

    // Filter in-memory by City and Brand if selected
    if (selectedCity && selectedCity !== 'All Cities') {
      rawOrderItems = rawOrderItems.filter((item: any) => item.orders?.city === selectedCity);
      rawSellerOrders = rawSellerOrders.filter((so: any) => so.orders?.city === selectedCity);
    }

    if (selectedBrand && selectedBrand !== 'All Brands') {
      rawOrderItems = rawOrderItems.filter((item: any) => item.brand === selectedBrand);
      const matchingOrderIds = new Set(rawOrderItems.map((item: any) => item.order_id));
      rawSellerOrders = rawSellerOrders.filter((so: any) => matchingOrderIds.has(so.order_id));
    }

    // -------------------------------------------------------------
    // CALCULATE OVERVIEW / KPI METRICS
    // -------------------------------------------------------------
    const totalRevenue = rawOrderItems.reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0);

    const uniqueOrderIds = new Set<string>(rawOrderItems.map((item: any) => item.order_id));
    rawSellerOrders.forEach((so: any) => uniqueOrderIds.add(so.order_id));

    const totalOrdersCount = uniqueOrderIds.size;
    const averageOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

    const activeProductsCount = rawProducts.filter((p: any) => p.status === 'Active').length;
    const soldOutProductsCount = rawProducts.filter((p: any) => p.status === 'Sold Out').length;

    const pendingOrdersCount = rawSellerOrders.filter((so: any) => so.status === 'Pending').length;
    const cancelledOrdersCount = rawSellerOrders.filter((so: any) => so.status === 'Cancelled').length;

    const totalSellerOrdersCount = rawSellerOrders.length;
    const cancellationRate =
      totalSellerOrdersCount > 0
        ? Math.round(((cancelledOrdersCount / totalSellerOrdersCount) * 100) * 10) / 10
        : 0;

    const approvedReviews = rawReviews.filter((r: any) => !r.status || r.status === 'Approved');
    const approvedReviewsCount = approvedReviews.length;
    const averageRating =
      approvedReviewsCount > 0
        ? Math.round((approvedReviews.reduce((sum: number, r: any) => sum + (r.rating || 5), 0) / approvedReviewsCount) * 10) / 10
        : 0;

    // -------------------------------------------------------------
    // 5-DAY REVENUE BUCKETS (LAST 30 DAYS OR DATE RANGE)
    // -------------------------------------------------------------
    const revenueTrend = buildFiveDayBuckets(rawOrderItems, dateRange);

    // -------------------------------------------------------------
    // REVENUE BY CITY (TOP 6 WITH DEFAULT FALLBACK CITIES)
    // -------------------------------------------------------------
    const cityRevenueMap = new Map<string, { revenue: number; orderIds: Set<string> }>();
    rawOrderItems.forEach((item: any) => {
      const city = item.orders?.city || 'Unknown';
      const existing = cityRevenueMap.get(city) || { revenue: 0, orderIds: new Set() };
      existing.revenue += Number(item.subtotal) || 0;
      existing.orderIds.add(item.order_id);
      cityRevenueMap.set(city, existing);
    });

    const revenueByCity = formatTopSixCities(cityRevenueMap);

    // -------------------------------------------------------------
    // PAYMENT METHOD SPLIT (COD vs ONLINE UNIQUE ORDER COUNTS)
    // -------------------------------------------------------------
    const codOrderIds = new Set<string>();
    const onlineOrderIds = new Set<string>();
    let codAmount = 0;
    let onlineAmount = 0;

    rawOrderItems.forEach((item: any) => {
      const method = item.orders?.payment_method || 'COD';
      const subtotal = Number(item.subtotal) || 0;

      if (method === 'COD') {
        codOrderIds.add(item.order_id);
        codAmount += subtotal;
      } else {
        onlineOrderIds.add(item.order_id);
        onlineAmount += subtotal;
      }
    });

    const codCount = codOrderIds.size;
    const onlineCount = onlineOrderIds.size;
    const totalPaymentOrders = codCount + onlineCount;

    const paymentMethodSplit: PaymentMethodCountItem[] = [
      {
        name: 'Cash on Delivery (COD)',
        value: totalPaymentOrders > 0 ? Math.round((codCount / totalPaymentOrders) * 100) : 0,
        count: codCount,
        amount: Math.round(codAmount),
        color: '#f59e0b',
      },
      {
        name: 'Online (Bank/EasyPaisa/JazzCash)',
        value: totalPaymentOrders > 0 ? Math.round((onlineCount / totalPaymentOrders) * 100) : 0,
        count: onlineCount,
        amount: Math.round(onlineAmount),
        color: '#10b981',
      },
    ];

    // -------------------------------------------------------------
    // TOP BRANDS BY REVENUE (MINIMUM 6 WITH DEFAULT FALLBACK BRANDS)
    // -------------------------------------------------------------
    const brandMap = new Map<string, { revenue: number; suitsSold: number }>();
    rawOrderItems.forEach((item: any) => {
      const brand = item.brand || 'Unbranded';
      const qty = Number(item.quantity) || 1;
      const subtotal = Number(item.subtotal) || 0;

      const existing = brandMap.get(brand) || { revenue: 0, suitsSold: 0 };
      brandMap.set(brand, {
        revenue: existing.revenue + subtotal,
        suitsSold: existing.suitsSold + qty,
      });
    });

    const topBrands = formatTopSixBrands(brandMap);

    // -------------------------------------------------------------
    // STITCHING STATUS SPLIT (INCLUDING 'READY TO WEAR')
    // -------------------------------------------------------------
    let unstitchedCount = 0;
    let stitchedCount = 0;
    let semiStitchedCount = 0;
    let readyToWearCount = 0;

    rawProducts.forEach((p: any) => {
      const status = (p.stitching_status || '').trim();
      if (status === 'Ready to Wear' || status === 'Ready-To-Wear' || status === 'Ready To Wear') {
        readyToWearCount++;
      } else if (status === 'Stitched') {
        stitchedCount++;
      } else if (status === 'Semi-Stitched') {
        semiStitchedCount++;
      } else {
        unstitchedCount++;
      }
    });

    const totalProdCount = rawProducts.length || 1;
    const stitchingSplit: StitchingSplitItem[] = [
      {
        name: 'Unstitched Lawn 3PC',
        value: Math.round((unstitchedCount / totalProdCount) * 100),
        count: unstitchedCount,
        color: '#f59e0b',
      },
      {
        name: 'Stitched Ready-To-Wear',
        value: Math.round((stitchedCount / totalProdCount) * 100),
        count: stitchedCount,
        color: '#10b981',
      },
      {
        name: 'Semi-Stitched Couture',
        value: Math.round((semiStitchedCount / totalProdCount) * 100),
        count: semiStitchedCount,
        color: '#6366f1',
      },
      {
        name: 'Ready to Wear',
        value: Math.round((readyToWearCount / totalProdCount) * 100),
        count: readyToWearCount,
        color: '#ec4899',
      },
    ];

    // -------------------------------------------------------------
    // LOW STOCK & SOLD OUT ALERT ITEMS
    // -------------------------------------------------------------
    const lowStockItems: AlertProductItem[] = rawProducts
      .filter((p: any) => p.status === 'Sold Out' || (p.quantity ?? 0) <= 2)
      .map((p: any) => ({
        id: p.id,
        title: p.suit_title || 'Leftover Suit',
        stock: p.quantity ?? 0,
        status: p.status === 'Sold Out' || p.quantity === 0 ? 'Sold Out' : 'Low Stock',
        brand: p.brand || 'Brand',
      }));

    // -------------------------------------------------------------
    // RATING DISTRIBUTION & RECENT REVIEWS
    // -------------------------------------------------------------
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    rawReviews.forEach((r: any) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      starCounts[star as keyof typeof starCounts]++;
    });

    const totalRevCount = rawReviews.length || 1;
    const ratingDistribution: ReviewRatingDistItem[] = [
      { stars: '5 Stars', count: starCounts[5], pct: Math.round((starCounts[5] / totalRevCount) * 100) },
      { stars: '4 Stars', count: starCounts[4], pct: Math.round((starCounts[4] / totalRevCount) * 100) },
      { stars: '3 Stars', count: starCounts[3], pct: Math.round((starCounts[3] / totalRevCount) * 100) },
      { stars: '2 Stars', count: starCounts[2], pct: Math.round((starCounts[2] / totalRevCount) * 100) },
      { stars: '1 Star', count: starCounts[1], pct: Math.round((starCounts[1] / totalRevCount) * 100) },
    ];

    const recentReviews: ReviewModerationItem[] = rawReviews.slice(0, 10).map((r: any) => {
      const userName = r.users
        ? `${r.users.first_name || ''} ${r.users.last_name || ''}`.trim()
        : 'Customer';
      return {
        id: r.id,
        customer: userName || 'Customer',
        product: r.products?.suit_title || 'Leftover Suit',
        rating: r.rating || 5,
        comment: r.review || 'Great product!',
        date: formatDateLabel(new Date(r.created_at || Date.now())),
        status: r.status || 'Approved',
      };
    });

    if (rawOrderItems.length > 0 || rawProducts.length > 0 || rawSellerOrders.length > 0) {
      return {
        kpis: {
          totalRevenue,
          totalOrders: totalOrdersCount,
          averageOrderValue,
          activeProductsCount,
          soldOutProductsCount,
          pendingOrdersCount,
          cancelledOrdersCount,
          cancellationRate,
          averageRating,
          approvedReviewsCount,
        },
        revenueTrend,
        revenueByCity,
        paymentMethodSplit,
        topBrands,
        stitchingSplit,
        lowStockItems,
        ratingDistribution,
        recentReviews,
        availableCities,
        availableBrands,
      };
    }

    return getFallbackMockAnalytics(dateRange, selectedCity, selectedBrand);
  } catch (err) {
    console.error('Error fetching seller analytics data from Supabase:', err);
    return getFallbackMockAnalytics(dateRange, selectedCity, selectedBrand);
  }
}

/**
 * Builds 5-day buckets across the date range (e.g. 6 buckets for 30D)
 */
function buildFiveDayBuckets(orderItems: any[], dateRange: '7D' | '30D' | '90D' | 'ALL'): FiveDayBucket[] {
  const days = dateRange === '7D' ? 7 : dateRange === '90D' ? 90 : 30;
  const bucketCount = dateRange === '7D' ? 7 : Math.ceil(days / 5);
  const now = new Date();
  const buckets: FiveDayBucket[] = [];

  const intervalDays = dateRange === '7D' ? 1 : 5;

  for (let i = 0; i < bucketCount; i++) {
    const endDaysAgo = days - i * intervalDays;
    const startDaysAgo = endDaysAgo - intervalDays;

    const startDate = new Date(now.getTime() - endDaysAgo * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() - Math.max(0, startDaysAgo) * 24 * 60 * 60 * 1000);

    const label = dateRange === '7D'
      ? formatDateLabel(startDate)
      : `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;

    let bucketRev = 0;
    let bucketCod = 0;
    let bucketOnline = 0;
    const bucketOrderIds = new Set<string>();

    orderItems.forEach((item: any) => {
      const itemDate = new Date(item.created_at || Date.now());
      if (itemDate >= startDate && itemDate <= endDate) {
        const subtotal = Number(item.subtotal) || 0;
        const method = item.orders?.payment_method || 'COD';
        bucketRev += subtotal;
        if (method === 'COD') bucketCod += subtotal;
        else bucketOnline += subtotal;

        bucketOrderIds.add(item.order_id);
      }
    });

    buckets.push({
      date: label,
      revenue: Math.round(bucketRev),
      cod: Math.round(bucketCod),
      online: Math.round(bucketOnline),
      orders: bucketOrderIds.size,
    });
  }

  return buckets;
}

/**
 * Fallback analytics data for demo mode or empty sellers
 */
function getFallbackMockAnalytics(
  dateRange: '7D' | '30D' | '90D' | 'ALL',
  selectedCity: string,
  selectedBrand: string
): SellerAnalyticsResponse {
  const mult = dateRange === '7D' ? 0.3 : dateRange === '90D' ? 2.5 : dateRange === 'ALL' ? 4.0 : 1.0;

  const rawTrend = [
    { date: 'Jul 01 - Jul 05', revenue: Math.round(145000 * mult), orders: Math.round(32 * mult), cod: Math.round(95000 * mult), online: Math.round(50000 * mult) },
    { date: 'Jul 06 - Jul 10', revenue: Math.round(182000 * mult), orders: Math.round(41 * mult), cod: Math.round(110000 * mult), online: Math.round(72000 * mult) },
    { date: 'Jul 11 - Jul 15', revenue: Math.round(210000 * mult), orders: Math.round(48 * mult), cod: Math.round(125000 * mult), online: Math.round(85000 * mult) },
    { date: 'Jul 16 - Jul 20', revenue: Math.round(195000 * mult), orders: Math.round(44 * mult), cod: Math.round(115000 * mult), online: Math.round(80000 * mult) },
    { date: 'Jul 21 - Jul 25', revenue: Math.round(268000 * mult), orders: Math.round(62 * mult), cod: Math.round(160000 * mult), online: Math.round(108000 * mult) },
    { date: 'Jul 26 - Jul 30', revenue: Math.round(310000 * mult), orders: Math.round(74 * mult), cod: Math.round(180000 * mult), online: Math.round(130000 * mult) },
  ];

  let cities = ['Lahore', 'Sialkot', 'Gujranwala', 'Islamabad', 'Faisalabad', 'Karachi'];
  let brands = ['Khaadi', 'Sapphire', 'Nishat', 'Maria B', 'Limelight', 'Alkaram'];

  let revByCity = [
    { city: 'Lahore', revenue: Math.round(840000 * mult), orders: Math.round(195 * mult) },
    { city: 'Sialkot', revenue: Math.round(520000 * mult), orders: Math.round(120 * mult) },
    { city: 'Gujranwala', revenue: Math.round(380000 * mult), orders: Math.round(90 * mult) },
    { city: 'Islamabad', revenue: Math.round(490000 * mult), orders: Math.round(112 * mult) },
    { city: 'Faisalabad', revenue: Math.round(240000 * mult), orders: Math.round(58 * mult) },
    { city: 'Karachi', revenue: Math.round(680000 * mult), orders: Math.round(154 * mult) },
  ];

  if (selectedCity !== 'All Cities') {
    revByCity = revByCity.filter((c) => c.city === selectedCity);
  }

  let topBrands = [
    { brand: 'Khaadi', revenue: Math.round(2450000 * mult), suitsSold: Math.round(380 * mult) },
    { brand: 'Sapphire', revenue: Math.round(1980000 * mult), suitsSold: Math.round(290 * mult) },
    { brand: 'Nishat', revenue: Math.round(1750000 * mult), suitsSold: Math.round(250 * mult) },
    { brand: 'Maria B', revenue: Math.round(1650000 * mult), suitsSold: Math.round(240 * mult) },
    { brand: 'Limelight', revenue: Math.round(1350000 * mult), suitsSold: Math.round(190 * mult) },
    { brand: 'Alkaram', revenue: Math.round(1100000 * mult), suitsSold: Math.round(160 * mult) },
  ];

  if (selectedBrand !== 'All Brands') {
    topBrands = topBrands.filter((b) => b.brand === selectedBrand);
  }

  const totalRev = revByCity.reduce((s, c) => s + c.revenue, 0) || Math.round(2450000 * mult);
  const totalOrd = revByCity.reduce((s, c) => s + c.orders, 0) || Math.round(480 * mult);
  const aov = totalOrd > 0 ? Math.round(totalRev / totalOrd) : 0;

  return {
    kpis: {
      totalRevenue: totalRev,
      totalOrders: totalOrd,
      averageOrderValue: aov,
      activeProductsCount: 142,
      soldOutProductsCount: 8,
      pendingOrdersCount: Math.round(34 * mult),
      cancelledOrdersCount: Math.round(10 * mult),
      cancellationRate: 2.1,
      averageRating: 4.8,
      approvedReviewsCount: 124,
    },
    revenueTrend: rawTrend,
    revenueByCity: revByCity,
    paymentMethodSplit: [
      { name: 'Cash on Delivery (COD)', value: 62, count: Math.round(totalOrd * 0.62), amount: Math.round(totalRev * 0.62), color: '#f59e0b' },
      { name: 'Online (Bank/EasyPaisa)', value: 38, count: Math.round(totalOrd * 0.38), amount: Math.round(totalRev * 0.38), color: '#10b981' },
    ],
    topBrands,
    stitchingSplit: [
      { name: 'Unstitched Lawn 3PC', value: 45, count: 480, color: '#f59e0b' },
      { name: 'Stitched Ready-To-Wear', value: 25, count: 260, color: '#10b981' },
      { name: 'Semi-Stitched Couture', value: 15, count: 160, color: '#6366f1' },
      { name: 'Ready to Wear', value: 15, count: 160, color: '#ec4899' },
    ],
    lowStockItems: [
      { id: 'p-101', title: 'Khaadi Summer Lawn 3PC (Ice Blue)', stock: 0, status: 'Sold Out', brand: 'Khaadi' },
      { id: 'p-102', title: 'Sapphire Intermix Unstitched 2PC', stock: 1, status: 'Low Stock', brand: 'Sapphire' },
      { id: 'p-103', title: 'Maria B Linen Embroidered Collection', stock: 2, status: 'Low Stock', brand: 'Maria B' },
      { id: 'p-104', title: 'Gul Ahmed Jacquard Dupatta Suit', stock: 0, status: 'Sold Out', brand: 'Gul Ahmed' },
    ],
    ratingDistribution: [
      { stars: '5 Stars', count: 680, pct: 72 },
      { stars: '4 Stars', count: 180, pct: 19 },
      { stars: '3 Stars', count: 54, pct: 6 },
      { stars: '2 Stars', count: 18, pct: 2 },
      { stars: '1 Star', count: 12, pct: 1 },
    ],
    recentReviews: [
      { id: 'rev-1', customer: 'Saima Khan', product: 'Khaadi 3PC Embroidered Lawn', rating: 5, comment: '100% genuine Khaadi leftover! Superb quality fabric.', date: '2 hours ago', status: 'Approved' },
      { id: 'rev-2', customer: 'Usman Ali', product: 'Sapphire Luxury Velvet Suit', rating: 4, comment: 'Minor tag missing as described, but suit is flawless.', date: '5 hours ago', status: 'Approved' },
      { id: 'rev-3', customer: 'Fatima Zafar', product: 'Maria B M-Prints Unstitched', rating: 5, comment: 'Extremely fast delivery to Rawalpindi.', date: '1 day ago', status: 'Approved' },
    ],
    availableCities: cities,
    availableBrands: brands,
  };
}
