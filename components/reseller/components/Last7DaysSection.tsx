'use client';

import React, { useMemo } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Package,
  Clock,
  Star,
  Layers,
  Calendar,
  AlertCircle,
  Activity,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import { ScrollableStatCard } from './common/ScrollableStatCard';
import { HorizontalScrollRow } from './common/HorizontalScrollRow';
import { Section2Last7d, SellerOverviewDetailsData } from '@/src/api/sellerOverviewService';

interface Last7DaysSectionProps {
  dataKpi?: Section2Last7d | null;
  dataDetails?: SellerOverviewDetailsData['graphs'] | null;
  loadingKpi?: boolean;
  loadingDetails?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onViewPendingOrders?: () => void;
}

// Custom Count-Up Animation Hook
function useCountUp(endValue: number, duration: number = 800, startAnimation: boolean = true): number {
  const [count, setCount] = React.useState<number>(0);

  React.useEffect(() => {
    if (!startAnimation) {
      setCount(0);
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutProgress = 1 - (1 - progress) * (1 - progress);
      setCount(Math.round(easeOutProgress * endValue));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [endValue, duration, startAnimation]);

  return count;
}

export const Last7DaysSection: React.FC<Last7DaysSectionProps> = ({
  dataKpi,
  dataDetails,
  loadingKpi = false,
  loadingDetails = false,
  error,
  onRefresh,
  onViewPendingOrders,
}) => {
  // Count Up Animated Values for Section 2 KPIs
  const animatedRevenue = useCountUp(dataKpi?.revenue_7d || 0, 800, !loadingKpi && !!dataKpi);
  const animatedOrders = useCountUp(dataKpi?.orders_7d || 0, 800, !loadingKpi && !!dataKpi);
  const animatedAov = useCountUp(dataKpi?.avg_order_value_7d || 0, 800, !loadingKpi && !!dataKpi);
  const animatedPending = useCountUp(dataKpi?.pending_fulfillment_7d || 0, 800, !loadingKpi && !!dataKpi);
  const animatedReviews = useCountUp(dataKpi?.new_reviews_7d || 0, 800, !loadingKpi && !!dataKpi);
  const animatedUnits = useCountUp(dataKpi?.units_sold_7d || 0, 800, !loadingKpi && !!dataKpi);

  // Donut Chart Data for 7-Day Order Status Breakdown (All 5 Categories Guaranteed)
  const statusData = useMemo(() => {
    if (!dataDetails?.order_status_breakdown) return [];
    const colorMap: Record<string, string> = {
      Pending: '#f59e0b',
      Confirmed: '#8b5cf6',
      Shipped: '#3b82f6',
      Delivered: '#10b981',
      Cancelled: '#f43f5e',
    };
    return dataDetails.order_status_breakdown.map((item) => ({
      name: item.status,
      value: item.count,
      color: colorMap[item.status] || '#a8a29e',
    }));
  }, [dataDetails]);

  // Donut Chart Data for Payment Method Share
  const paymentData = useMemo(() => {
    if (!dataDetails?.payment_method_share) return [];
    const p = dataDetails.payment_method_share;
    return [
      { name: 'Cash on Delivery (COD)', value: p.cod, pct: p.cod_pct, color: '#f59e0b' },
      { name: 'Online (Bank/EasyPaisa)', value: p.online, pct: p.online_pct, color: '#10b981' },
    ];
  }, [dataDetails]);

  return (
    <div className="space-y-6 bg-stone-50/80 p-4 sm:p-6 rounded-xl border border-stone-200 shadow-2xs">
      {/* SECTION HEADER */}
      <div className="pb-2 border-b border-stone-200 space-y-2">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-amber-500" />
          <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-stone-900">
            Last 7 Days Performance
          </h2>
        </div>


        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="flex flex-1 min-w-0 items-center gap-1 text-[11px] sm:text-xs text-stone-500 font-semibold">
            <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span className="truncate">
              Trailing 7-Day Performance Window
            </span>
          </p>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loadingKpi || loadingDetails}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5
                 bg-white hover:bg-stone-100 border border-stone-200
                 text-[10px] sm:text-xs font-bold text-stone-700
                 rounded-md shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${loadingKpi || loadingDetails ? 'animate-spin' : ''
                  }`}
              />

            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================
          SECTION 2: 6 "LAST 7 DAYS PERFORMANCE" CARDS
          Horizontally scrollable row across all viewports
         ========================================================= */}
      <HorizontalScrollRow showScrollButtons>
        {/* CARD 1: REVENUE (LAST 7D) */}
        <ScrollableStatCard
          title="REVENUE (LAST 7D)"
          value={`Rs. ${animatedRevenue.toLocaleString()}`}
          subtitle="Trailing 7 days sales"
          icon={DollarSign}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-700"
          loading={loadingKpi}
        />

        {/* CARD 2: ORDERS (LAST 7D) */}
        <ScrollableStatCard
          title="ORDERS (LAST 7D)"
          value={`${animatedOrders} Orders`}
          subtitle="Non-cancelled order volume"
          icon={ShoppingBag}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          loading={loadingKpi}
        />

        {/* CARD 3: AVG ORDER VALUE (LAST 7D) */}
        <ScrollableStatCard
          title="AVG ORDER VALUE"
          value={`Rs. ${animatedAov.toLocaleString()}`}
          subtitle="Average per seller order"
          icon={Layers}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
          loading={loadingKpi}
        />

        {/* CARD 4: PENDING FULFILLMENT (LAST 7D) */}
        <ScrollableStatCard
          title="PENDING FULFILLMENT"
          value={`${animatedPending} Orders`}
          subtitle="Click to view active queue →"
          icon={Clock}
          iconBgColor="bg-amber-100"
          iconTextColor="text-amber-700"
          borderAccent="border-l-amber-500"
          onClick={onViewPendingOrders}
          loading={loadingKpi}
        />

        {/* CARD 5: NEW REVIEWS (LAST 7D) */}
        <ScrollableStatCard
          title="NEW REVIEWS"
          value={`${animatedReviews} Reviews`}
          subtitle="Customer ratings in 7D"
          icon={Star}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-500"
          loading={loadingKpi}
        />

        {/* CARD 6: UNITS SOLD (LAST 7D) */}
        <ScrollableStatCard
          title="UNITS SOLD"
          value={`${animatedUnits} Suits`}
          subtitle="Total quantity moved"
          icon={Package}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          loading={loadingKpi}
        />
      </HorizontalScrollRow>

      {/* =========================================================
          SECTION 3: GRAPHS SECTION (SPLIT LAYOUT)
         ========================================================= */}
      <div className="space-y-6 pt-2">
        {/* GRAPH 1: DAILY REVENUE TRAJECTORY ($) — FULL WIDTH PRIMARY CHART */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
          <div>
            <h3 className="text-xs sm:text-sm lg:text-sm font-bold uppercase tracking-wider text-stone-900">
              Daily Revenue Trajectory ($)
            </h3>
            <p className="text-[9px] sm:text-xs lg:text-xs text-stone-500">
              Daily seller revenue trajectory over trailing 7 days
            </p>
          </div>

          {loadingDetails ? (
            <div className="h-64 w-full bg-stone-100 rounded-lg animate-pulse" />
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dataDetails?.daily_revenue_trajectory || []}
                  margin={{ top: 20, right: 20, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRev7D" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="shortDay" stroke="#a8a29e" fontSize={11} />
                  <YAxis stroke="#a8a29e" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip content={<CustomRevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue ($)"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRev7D)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 4-GRAPH HORIZONTAL SCROLLABLE ROW BELOW FULL-WIDTH CHART */}
        <HorizontalScrollRow showScrollButtons className="pt-1 pb-3">
          {/* GRAPH 2: DAILY ORDER VOLUME */}
          <div className="shrink-0 snap-start min-w-[280px] sm:min-w-[320px] lg:min-w-[360px] bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
              Daily Order Volume
            </h3>
            {loadingDetails ? (
              <div className="h-60 w-full bg-stone-100 rounded-lg animate-pulse" />
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataDetails?.daily_order_volume || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                    <XAxis dataKey="shortDay" stroke="#a8a29e" fontSize={11} />
                    <YAxis stroke="#a8a29e" fontSize={11} />
                    <Tooltip content={<CustomOrdersTooltip />} />
                    <Bar dataKey="orders_count" name="Orders" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* GRAPH 3: 7-DAY ORDER STATUS BREAKDOWN */}
          <div className="shrink-0 snap-start min-w-[280px] sm:min-w-[320px] lg:min-w-[360px] bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
              7-Day Order Status Breakdown
            </h3>
            {loadingDetails ? (
              <div className="h-60 w-full bg-stone-100 rounded-lg animate-pulse" />
            ) : (
              <div className="h-60 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`status-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomStatusTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* GRAPH 4: TOP 5 PRODUCTS SOLD (LAST 7 DAYS) */}
          <div className="shrink-0 snap-start min-w-[280px] sm:min-w-[320px] lg:min-w-[360px] bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
              Top 5 Products Sold (Last 7 Days)
            </h3>
            {loadingDetails ? (
              <div className="h-60 w-full bg-stone-100 rounded-lg animate-pulse" />
            ) : (
              <div className="h-60 w-full">
                {dataDetails?.top_products_sold && dataDetails.top_products_sold.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={dataDetails.top_products_sold} margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                      <XAxis type="number" stroke="#a8a29e" fontSize={11} />
                      <YAxis
                        dataKey="product_title"
                        type="category"
                        stroke="#a8a29e"
                        fontSize={10}
                        width={110}
                        tickFormatter={(val) => (val.length > 15 ? `${val.substring(0, 15)}...` : val)}
                      />
                      <Tooltip content={<CustomProductTooltip />} />
                      <Bar dataKey="units_sold" name="Units Sold" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-stone-400 italic flex items-center justify-center h-full">
                    No product sales recorded in the last 7 days
                  </div>
                )}
              </div>
            )}
          </div>

          {/* GRAPH 5: PAYMENT METHOD SHARE (COD vs Online) */}
          <div className="shrink-0 snap-start min-w-[280px] sm:min-w-[320px] lg:min-w-[360px] bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
              Payment Method Share (COD vs Online)
            </h3>
            {loadingDetails ? (
              <div className="h-60 w-full bg-stone-100 rounded-lg animate-pulse" />
            ) : (
              <div className="h-60 w-full flex items-center justify-center">
                {paymentData.some((p) => p.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`pay-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPaymentTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-stone-400 italic flex items-center justify-center h-full">
                    No payment records
                  </div>
                )}
              </div>
            )}
          </div>
        </HorizontalScrollRow>
      </div>
    </div>
  );
};

// Custom Tooltips
const CustomRevenueTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-stone-900 text-white p-3 rounded-lg text-xs space-y-1 shadow-lg border border-stone-800">
        <p className="font-extrabold uppercase text-[10px] text-amber-400">{d.date}</p>
        <p className="font-bold">
          Revenue: <span className="text-emerald-400">Rs. {(d.revenue || 0).toLocaleString()}</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomOrdersTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-stone-900 text-white p-3 rounded-lg text-xs space-y-1 shadow-lg border border-stone-800">
        <p className="font-extrabold uppercase text-[10px] text-amber-400">{d.date}</p>
        <p className="font-bold">
          Orders Count: <span className="text-amber-400">{d.orders_count}</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomStatusTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0];
    return (
      <div className="bg-stone-900 text-white p-2.5 rounded-lg text-xs shadow-lg border border-stone-800">
        <p className="font-bold" style={{ color: d.payload.color }}>
          {d.name}: {d.value} orders
        </p>
      </div>
    );
  }
  return null;
};

const CustomProductTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-stone-900 text-white p-3 rounded-lg text-xs space-y-1 shadow-lg border border-stone-800">
        <p className="font-extrabold text-amber-400">{d.product_title}</p>
        <p className="text-stone-300">
          Brand: <span className="font-semibold text-white">{d.brand}</span>
        </p>
        <p className="font-bold text-emerald-400">Units Sold: {d.units_sold}</p>
        <p className="text-stone-300">Revenue: Rs. {(d.revenue || 0).toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

const CustomPaymentTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-stone-900 text-white p-2.5 rounded-lg text-xs shadow-lg border border-stone-800">
        <p className="font-bold" style={{ color: d.color }}>
          {d.name}: {d.value} orders ({d.pct}%)
        </p>
      </div>
    );
  }
  return null;
};

export default Last7DaysSection;
