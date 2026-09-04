'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  XCircle,
  Package,
  Activity,
  AlertTriangle,
  Star,
  X,
  Layers,
  BarChart3,
  Moon,
  Sun,
  Download,
  Clock,
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

import useAuth from '@/src/hooks/useAuth';
import {
  fetchSellerAnalyticsData,
  SellerAnalyticsResponse,
} from '@/src/api/sellerAnalyticsService';
import { HorizontalScrollRow } from './common/HorizontalScrollRow';

// ==========================================
// 1. REUSABLE KPI CARD COMPONENT
// ==========================================

interface KpiCardProps {
  title: string;
  value: string | number;
  format?: 'currency' | 'number' | 'percent' | 'rating';
  ratingStars?: number;
  trendPercent?: number;
  trendDirection?: 'up' | 'down';
  invertTrendColor?: boolean;
  accentBorder?: 'none' | 'amber' | 'red' | 'emerald' | 'blue';
  subtext?: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
  isDarkMode?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  format = 'number',
  ratingStars = 5,
  trendPercent,
  trendDirection,
  invertTrendColor = false,
  accentBorder = 'none',
  subtext,
  icon,
  loading = false,
  isDarkMode = false,
}) => {
  if (loading) {
    return (
      <div
        className={`p-4 rounded-xl border shadow-xs animate-pulse space-y-3 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
          }`}
      >
        <div className="flex justify-between items-center">
          <div className="h-3 w-24 bg-stone-300 dark:bg-stone-800 rounded-xs" />
          <div className="h-4 w-4 bg-stone-300 dark:bg-stone-800 rounded-full" />
        </div>
        <div className="h-7 w-32 bg-stone-300 dark:bg-stone-800 rounded-xs" />
        <div className="h-3 w-20 bg-stone-200 dark:bg-stone-800 rounded-xs" />
      </div>
    );
  }

  let borderStyle = isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200';
  if (accentBorder === 'amber') {
    borderStyle += ' border-l-4 border-l-amber-500';
  } else if (accentBorder === 'red') {
    borderStyle += ' border-l-4 border-l-rose-600';
  } else if (accentBorder === 'emerald') {
    borderStyle += ' border-l-4 border-l-emerald-500';
  } else if (accentBorder === 'blue') {
    borderStyle += ' border-l-4 border-l-blue-500';
  }

  let isGood = true;
  if (trendDirection === 'up') {
    isGood = !invertTrendColor;
  } else if (trendDirection === 'down') {
    isGood = invertTrendColor;
  }

  const trendColorClass = isGood ? 'text-emerald-600' : 'text-rose-600';

  return (
    <div
      className={`p-4 sm:p-5 rounded-xl border shadow-xs transition-all flex flex-col justify-between h-full ${borderStyle}`}
    >
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] sm:text-xs lg:text-xs font-extrabold uppercase tracking-wider text-stone-400">
            {title}
          </span>
          <div className="shrink-0">{icon}</div>
        </div>

        <div className="mt-1">
          {format === 'rating' ? (
            <div className="flex items-center space-x-2">
              <span className="text-sm sm:text-xl lg:text-xl font-bold tracking-tight">{value}</span>
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3.5 h-3.5 ${star <= Math.round(Number(value) || ratingStars)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-stone-200'
                      }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm sm:text-xl lg:text-xl font-bold tracking-tight font-mono text-stone-900 dark:text-stone-100">
              {value}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between text-[9px] sm:text-xs lg:text-xs">
        {trendPercent !== undefined && trendDirection ? (
          <div className={`flex items-center space-x-1 font-bold ${trendColorClass}`}>
            {trendDirection === 'up' ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>
              {trendPercent > 0 ? `+${trendPercent}%` : `${trendPercent}%`}
            </span>
          </div>
        ) : (
          <div />
        )}

        {subtext && (
          <span className="font-semibold text-stone-500 dark:text-stone-400">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 2. MAIN ANALYTICS VIEW COMPONENT
// ==========================================

export const AnalyticsView: React.FC = () => {
  const { user, resellerProfile } = useAuth();
  const sellerId = resellerProfile?.id || user?.id || 'demo-reseller-id';

  const [dateRange, setDateRange] = useState<'7D' | '30D' | '90D' | 'ALL'>('30D');
  const [selectedCity, setSelectedCity] = useState<string>('All Cities');
  const [selectedBrand, setSelectedBrand] = useState<string>('All Brands');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'reviews'>('sales');

  const [analyticsData, setAnalyticsData] = useState<SellerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSellerAnalyticsData({
        sellerId,
        dateRange,
        selectedCity,
        selectedBrand,
      });
      setAnalyticsData(data);
    } catch (err: any) {
      console.error('Failed to load seller analytics:', err);
      setError('Unable to fetch live analytics data. Showing offline metrics.');
    } finally {
      setLoading(false);
    }
  }, [sellerId, dateRange, selectedCity, selectedBrand]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const exportToCSV = (filename: string, rows: object[]) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(',');
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows.map((e) => Object.values(e).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = analyticsData?.kpis;

  return (
    <div
      className={`space-y-6 sm:space-y-8 p-3 sm:p-5 lg:p-8 rounded-2xl transition-colors duration-300 max-w-8xl mx-auto ${isDarkMode ? 'bg-stone-950 text-stone-100' : 'bg-stone-50 text-stone-900'
        }`}
    >
      {/* FIX #1 & FIX #2: HEADER CONTROL BAR WITH HORIZONTALLY SCROLLABLE ACTION BUTTONS */}
      <div
        className={`p-4 sm:p-6 rounded-2xl border shadow-xs flex flex-col gap-4 transition-colors ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
          }`}
      >
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold uppercase tracking-wider flex items-center space-x-2">
            <Activity className="w-6 h-6 text-amber-500 shrink-0" />
            <span>Seller Analytics Dashboard</span>
          </h1>
        </div>

        {/* FIX #2: LEFT-SIDE ACTION BUTTONS ROW (SINGLE HORIZONTALLY SCROLLABLE ROW, NEVER WRAPS) */}
        <HorizontalScrollRow className="pb-1" showScrollButtons={false}>
          <button
            onClick={loadAnalytics}
            className={`p-2 sm:p-2.5 border rounded-lg transition-colors cursor-pointer shrink-0 min-h-[36px] sm:min-h-[38px] flex items-center justify-center ${isDarkMode
                ? 'bg-stone-800 border-stone-700 text-stone-300 hover:text-white'
                : 'bg-stone-100 border-stone-200 text-stone-700 hover:text-black'
              }`}
            title="Refresh Analytics Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Date Range Selector */}
          <div
            className={`flex items-center border rounded-lg p-1 shrink-0 ${isDarkMode ? 'bg-stone-950 border-stone-800' : 'bg-stone-100 border-stone-200'
              }`}
          >
            {(['7D', '30D', '90D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm lg:px-4 lg:py-2 lg:text-sm font-bold rounded-md transition-all cursor-pointer shrink-0 ${dateRange === r
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : isDarkMode
                      ? 'text-stone-400 hover:text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
              >
                {r === '7D'
                  ? '7D'
                  : r === '30D'
                    ? '30D'
                    : r === '90D'
                      ? '90D'
                      : 'All'}
              </button>
            ))}
          </div>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className={`px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm lg:px-4 lg:py-2 lg:text-sm font-semibold border rounded-lg focus:outline-none cursor-pointer shrink-0 min-h-[36px] sm:min-h-[38px] ${isDarkMode
                ? 'bg-stone-950 border-stone-800 text-stone-200'
                : 'bg-white border-stone-300 text-stone-800'
              }`}
          >
            <option value="All Cities">All Cities</option>
            {analyticsData?.availableCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className={`px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm lg:px-4 lg:py-2 lg:text-sm font-semibold border rounded-lg focus:outline-none cursor-pointer shrink-0 min-h-[36px] sm:min-h-[38px] ${isDarkMode
                ? 'bg-stone-950 border-stone-800 text-stone-200'
                : 'bg-white border-stone-300 text-stone-800'
              }`}
          >
            <option value="All Brands">All Brands</option>
            {analyticsData?.availableBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 sm:p-2.5 border rounded-lg transition-colors cursor-pointer shrink-0 min-h-[36px] sm:min-h-[38px] flex items-center justify-center ${isDarkMode
                ? 'bg-stone-800 border-stone-700 text-amber-400'
                : 'bg-stone-100 border-stone-200 text-stone-700'
              }`}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() =>
              exportToCSV('Zebaish_Seller_Analytics_Report', analyticsData?.revenueTrend || [])
            }
            className="px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm lg:px-4 lg:py-2 lg:text-sm bg-stone-900 hover:bg-black text-white font-bold uppercase tracking-wider rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer shrink-0 min-h-[36px] sm:min-h-[38px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </HorizontalScrollRow>
      </div>

      {/* Active Filter Chips */}
      {(selectedCity !== 'All Cities' || selectedBrand !== 'All Brands') && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs lg:text-sm">
          <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px] sm:text-xs">
            Active Filters:
          </span>
          {selectedCity !== 'All Cities' && (
            <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full font-semibold border border-amber-300 flex items-center space-x-1 shrink-0">
              <span>City: {selectedCity}</span>
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCity('All Cities')} />
            </span>
          )}
          {selectedBrand !== 'All Brands' && (
            <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-full font-semibold border border-emerald-300 flex items-center space-x-1 shrink-0">
              <span>Brand: {selectedBrand}</span>
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedBrand('All Brands')} />
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs sm:text-sm font-semibold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* FIX #3: SELLER KEY PERFORMANCE INDICATORS KPI CARDS - 2 HORIZONTALLY SCROLLABLE ROWS (4 CARDS EACH) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm lg:text-base font-extrabold uppercase tracking-widest text-stone-500 flex items-center space-x-1.5">
            <BarChart3 className="w-4 h-4 text-amber-500 shrink-0" />
            <span>SELLER KEY PERFORMANCE INDICATORS</span>
          </h2>
          <span className="text-[10px] sm:text-xs lg:text-sm text-stone-400 font-semibold">
            Filtered by {dateRange === '7D' ? '7 Days' : dateRange === '30D' ? '30 Days' : dateRange === '90D' ? '90 Days' : 'All Time'} Range
          </span>
        </div>

        {/* Row 1: First 4 KPI cards */}
        <HorizontalScrollRow showScrollButtons={false}>
          <div className="shrink-0 w-64 sm:w-72 lg:w-1/4 snap-start">
            <KpiCard
              title="MY TOTAL REVENUE"
              value={`Rs. ${(kpis?.totalRevenue || 0).toLocaleString()}`}
              format="currency"
              trendDirection="up"
              subtext="vs prev period"
              icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
              loading={loading}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="shrink-0 w-64 sm:w-72 lg:w-1/4 snap-start">
            <KpiCard
              title="MY TOTAL ORDERS"
              value={`${(kpis?.totalOrders || 0).toLocaleString()} Orders`}
              format="number"
              trendDirection="up"
              subtext="vs prev period"
              icon={<ShoppingBag className="w-4 h-4 text-amber-500" />}
              loading={loading}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="shrink-0 w-64 sm:w-72 lg:w-1/4 snap-start">
            <KpiCard
              title="MY AVERAGE ORDER VALUE"
              value={`Rs. ${(kpis?.averageOrderValue || 0).toLocaleString()}`}
              format="currency"
              trendDirection="up"
              subtext="per seller order"
              icon={<Layers className="w-4 h-4 text-indigo-500" />}
              loading={loading}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="shrink-0 w-64 sm:w-72 lg:w-1/4 snap-start">
            <KpiCard
              title="ACTIVE LISTINGS"
              value={`${kpis?.activeProductsCount || 0} Active`}
              format="number"
              subtext="Current inventory state"
              icon={<Package className="w-4 h-4 text-blue-500" />}
              loading={loading}
              isDarkMode={isDarkMode}
            />
          </div>
        </HorizontalScrollRow>

        {/* Row 2: Next 4 KPI cards */}
        <HorizontalScrollRow showScrollButtons={false}>
          <div className="shrink-0 w-64 sm:w-72 lg:w-1/4 snap-start">
            <KpiCard
              title="SOLD OUT PRODUCTS"
              value={`${kpis?.soldOutProductsCount || 0} Items`}
              format="number"
              accentBorder="amber"
              subtext="Requires seller restock"
              icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
              loading={loading}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="shrink-0 w-64 sm:w-72 lg:w-1/4 snap-start">
            <KpiCard
              title="PENDING FULFILLMENT"
              value={`${kpis?.pendingOrdersCount || 0} Orders`}
              format="number"
              accentBorder="red"
              subtext="Pending seller dispatch"
              icon={<Clock className="w-4 h-4 text-rose-600" />}
              loading={loading}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="shrink-0 w-64 sm:w-72 lg:w-1/4 snap-start">
            <KpiCard
              title="CANCELLATION RATE"
              value={`${kpis?.cancellationRate || 0}%`}
              format="percent"
              trendDirection="down"
              invertTrendColor={true}
              subtext="vs prev period"
              icon={<XCircle className="w-4 h-4 text-rose-500" />}
              loading={loading}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="shrink-0 w-64 sm:w-72 lg:w-1/4 snap-start">
            <KpiCard
              title="AVERAGE RATING"
              value={kpis?.averageRating ? kpis.averageRating.toFixed(1) : '0.0'}
              format="rating"
              ratingStars={5}
              subtext={`(${kpis?.approvedReviewsCount || 0} approved reviews)`}
              icon={<Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
              loading={loading}
              isDarkMode={isDarkMode}
            />
          </div>
        </HorizontalScrollRow>
      </div>

      {/* TAB NAVIGATION */}
      <HorizontalScrollRow className="border-b border-stone-200 pb-1" showScrollButtons={false}>
        {[
          { id: 'sales', label: 'Sales & Revenue', icon: BarChart3 },
          { id: 'inventory', label: 'Product & Inventory', icon: Package },
          { id: 'reviews', label: 'Reviews & Rating', icon: Star },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-3 border-b-2 text-xs sm:text-sm lg:text-base font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer shrink-0 ${activeTab === tab.id
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </HorizontalScrollRow>

      {/* TAB 1: SALES & REVENUE ANALYTICS */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div
            className={`p-4 sm:p-6 rounded-2xl border shadow-xs space-y-4 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
              }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base lg:text-lg font-extrabold uppercase tracking-wider">
                  Seller Revenue Trend (5-Day Intervals)
                </h3>
                <p className="text-xs sm:text-sm lg:text-base text-stone-500">
                  Seller-specific revenue trajectory comparing COD vs Online digital payments
                </p>
              </div>
              <span className="text-xs sm:text-sm font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto shrink-0">
                Total Revenue: Rs. {(kpis?.totalRevenue || 0).toLocaleString()}
              </span>
            </div>

            <div className="h-64 sm:h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData?.revenueTrend || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCod" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#27272a' : '#f5f5f4'} />
                  <XAxis dataKey="date" stroke="#a8a29e" fontSize={11} />
                  <YAxis stroke="#a8a29e" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#18181b' : '#fff',
                      borderColor: '#d6d3d1',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Total Seller Revenue (Rs.)"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cod"
                    name="COD Revenue (Rs.)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCod)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FIX #4: SALES & REVENUE GRAPHS IN ONE HORIZONTALLY SCROLLABLE ROW */}
          <HorizontalScrollRow showScrollButtons={false}>
            {/* Graph 1: Revenue by City */}
            <div
              className={`shrink-0 min-w-[300px] sm:min-w-[340px] lg:min-w-[380px] flex-1 snap-start p-4 sm:p-6 rounded-2xl border shadow-xs space-y-4 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
                }`}
            >
              <h3 className="text-sm sm:text-base lg:text-lg font-extrabold uppercase tracking-wider">
                Seller Revenue Breakdown by City (Top 6)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={analyticsData?.revenueByCity || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#27272a' : '#f5f5f4'} />
                    <XAxis type="number" stroke="#a8a29e" fontSize={11} />
                    <YAxis dataKey="city" type="category" stroke="#a8a29e" fontSize={11} width={80} />
                    <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#18181b' : '#fff', borderRadius: '8px', fontSize: '11px' }} />
                    <Bar dataKey="revenue" name="Revenue (Rs.)" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Graph 2: Payment Method Share */}
            <div
              className={`shrink-0 min-w-[300px] sm:min-w-[340px] lg:min-w-[380px] flex-1 snap-start p-4 sm:p-6 rounded-2xl border shadow-xs space-y-4 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
                }`}
            >
              <h3 className="text-sm sm:text-base lg:text-lg font-extrabold uppercase tracking-wider">
                Payment Method Share (COD vs Online Unique Orders)
              </h3>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData?.paymentMethodSplit || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(analyticsData?.paymentMethodSplit || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#18181b' : '#fff', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </HorizontalScrollRow>
        </div>
      )}

      {/* TAB 2: PRODUCT & INVENTORY ANALYTICS */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* FIX #5: PRODUCT & INVENTORY GRAPHS IN ONE HORIZONTALLY SCROLLABLE ROW */}
          <HorizontalScrollRow showScrollButtons={false}>
            {/* Graph 1: Top Brands */}
            <div
              className={`shrink-0 min-w-[300px] sm:min-w-[340px] lg:min-w-[380px] flex-1 snap-start p-4 sm:p-6 rounded-2xl border shadow-xs space-y-4 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
                }`}
            >
              <h3 className="text-sm sm:text-base lg:text-lg font-extrabold uppercase tracking-wider">
                Top Brands by Seller Revenue
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData?.topBrands || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#27272a' : '#f5f5f4'} />
                    <XAxis dataKey="brand" stroke="#a8a29e" fontSize={11} />
                    <YAxis stroke="#a8a29e" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#18181b' : '#fff', borderRadius: '8px', fontSize: '11px' }} />
                    <Bar dataKey="revenue" name="Revenue (Rs.)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Graph 2: Stitching Status */}
            <div
              className={`shrink-0 min-w-[300px] sm:min-w-[340px] lg:min-w-[380px] flex-1 snap-start p-4 sm:p-6 rounded-2xl border shadow-xs space-y-4 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
                }`}
            >
              <h3 className="text-sm sm:text-base lg:text-lg font-extrabold uppercase tracking-wider">
                Stitching Status Category Split
              </h3>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData?.stitchingSplit || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(analyticsData?.stitchingSplit || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#18181b' : '#fff', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </HorizontalScrollRow>

          {/* FIX #6: Low Stock Alert Widget */}
          <div
            className={`p-4 sm:p-6 rounded-2xl border shadow-xs space-y-4 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
              }`}
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold flex items-center space-x-2 text-rose-600">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Low Stock & Sold Out Alert Widget</span>
              </h3>
              <span className="text-[10px] sm:text-xs lg:text-sm font-semibold text-stone-500">
                Requires Seller Restock
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {(analyticsData?.lowStockItems || []).map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
                  <span className="text-[10px] sm:text-xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-stone-900 text-white">
                    {item.brand}
                  </span>
                  <p className="text-xs sm:text-sm lg:text-base font-bold line-clamp-1">{item.title}</p>
                  <div className="flex items-center justify-between text-[10px] sm:text-xs lg:text-sm pt-1">
                    <span className="font-semibold text-stone-500">Qty Remaining: {item.stock}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold ${item.status === 'Sold Out' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REVIEWS & QUALITY MODERATION */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <HorizontalScrollRow showScrollButtons={false}>
            <div
              className={`shrink-0 min-w-[300px] sm:min-w-[340px] lg:min-w-[380px] flex-1 snap-start p-4 sm:p-6 rounded-2xl border shadow-xs space-y-4 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
                }`}
            >
              <h3 className="text-sm sm:text-base lg:text-lg font-extrabold uppercase tracking-wider">
                Approved Buyer Star Rating Breakdown
              </h3>
              <div className="space-y-2.5">
                {(analyticsData?.ratingDistribution || []).map((r) => (
                  <div key={r.stars} className="flex items-center space-x-3 text-xs sm:text-sm">
                    <span className="w-16 font-bold text-stone-600">{r.stars}</span>
                    <div className="flex-1 bg-stone-100 h-3 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="w-12 text-right font-bold text-stone-500">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`shrink-0 min-w-[300px] sm:min-w-[340px] lg:min-w-[380px] flex-1 snap-start p-4 sm:p-6 rounded-2xl border shadow-xs space-y-4 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
                }`}
            >
              <h3 className="text-sm sm:text-base lg:text-lg font-extrabold uppercase tracking-wider">
                Approved Customer Reviews Log
              </h3>
              <div className="space-y-3">
                {(analyticsData?.recentReviews || []).map((rev) => (
                  <div key={rev.id} className="p-3.5 border border-stone-200 rounded-xl bg-stone-50/50 space-y-1.5 text-xs sm:text-sm">
                    <div className="flex justify-between font-bold">
                      <span className="text-stone-900">{rev.customer}</span>
                      <span className="text-amber-500">★ {rev.rating}/5</span>
                    </div>
                    <p className="text-stone-600 italic">"{rev.comment}"</p>
                    <div className="text-[10px] sm:text-xs text-stone-400 font-semibold text-right">
                      {rev.product} • {rev.date}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </HorizontalScrollRow>
        </div>
      )}
    </div>
  );
};

export default AnalyticsView;
