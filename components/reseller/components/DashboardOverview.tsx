import React from 'react';
import { TrendingUp, Package, Truck, Wallet, CheckCircle, Star, AlertCircle } from 'lucide-react';
import { Order } from '@/types';
import { Last7DaysSection } from './Last7DaysSection';
import { ResponsiveTable, ColumnDef } from './common/ResponsiveTable';
import { ScrollableStatCard } from './common/ScrollableStatCard';
import { HorizontalScrollRow } from './common/HorizontalScrollRow';
import { useSellerDashboard } from '@/hooks/useSellerDashboard';
import { RecentDashboardOrder } from '@/lib/seller/dashboard-types';
import { formatPrice } from '@/lib/home-static-data';

interface DashboardOverviewProps {
  sellerId?: string;
  myListingsCount?: number;
  orders?: Order[];
  onViewAllOrders: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onViewAllOrders,
}) => {
  const { data, status, error, reload } = useSellerDashboard();

  const isLoading = status === 'loading';
  const ov = data?.overview;

  const orderColumns: ColumnDef<RecentDashboardOrder>[] = [
    {
      header: 'Order Number',
      cell: (row) => (
        <span className="font-bold font-mono text-stone-900">{row.order_number}</span>
      ),
    },
    {
      header: 'Customer & City',
      cell: (row) => (
        <div>
          <span className="font-semibold block text-stone-900">{row.customer_name}</span>
          <span className="text-[11px] text-stone-500">{row.city}</span>
        </div>
      ),
    },
    {
      header: 'Brand & Product',
      cell: (row) => (
        <div>
          <span className="font-bold text-stone-900 block">{row.brand}</span>
          <span className="text-[11px] text-stone-600 block truncate max-w-[200px]">
            {row.product_title}
          </span>
        </div>
      ),
    },
    {
      header: 'Amount',
      cell: (row) => (
        <span className="font-bold text-stone-900 font-mono">
          {formatPrice(row.seller_total || 0)}
        </span>
      ),
    },
    {
      header: 'Dispatch Status',
      cell: (row) => {
        const isDelivered = row.status === 'Delivered';
        const isShipped = row.status === 'Shipped';
        const isPending =
          row.status === 'Pending' || row.status === 'Confirmed' || row.status === 'Processing';

        let badgeStyle = 'bg-stone-100 text-stone-800';
        if (isDelivered) badgeStyle = 'bg-emerald-100 text-emerald-800';
        else if (isShipped) badgeStyle = 'bg-blue-100 text-blue-800';
        else if (isPending) badgeStyle = 'bg-amber-100 text-amber-900';

        return (
          <span
            className={`font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-full uppercase inline-block ${badgeStyle}`}
          >
            {row.status}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {status === 'error' && error && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 px-3 py-1 bg-white hover:bg-red-100 border border-red-300 text-red-800 rounded-md text-xs font-bold transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* =========================================================
          SECTION 1 — MAIN KPI CARDS (PHASE 1 LOAD)
          Horizontally scrollable row across phone, tablet, desktop
         ========================================================= */}
      <div>
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-[10px] sm:text-xs lg:text-xs font-bold uppercase tracking-wider text-stone-400">
            Seller Performance Overview
          </h2>
        </div>

        <HorizontalScrollRow showScrollButtons>
          {/* STAT CARD 1: TOTAL REVENUE */}
          <ScrollableStatCard
            title="TOTAL REVENUE"
            value={formatPrice(ov?.totalRevenue ?? 0)}
            subtitle="Generated from platform sales"
            icon={TrendingUp}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-700"
            loading={isLoading}
          />

          {/* STAT CARD 2: PAYABLE COMMISSION */}
          <ScrollableStatCard
            title="PAYABLE COMMISSION"
            value={formatPrice(ov?.payableCommission ?? 0)}
            subtitle="Pending bank transfer"
            icon={Wallet}
            iconBgColor="bg-amber-100"
            iconTextColor="text-amber-900"
            loading={isLoading}
          />

          {/* STAT CARD 3: ACTIVE LISTINGS */}
          <ScrollableStatCard
            title="ACTIVE LISTINGS"
            value={`${ov?.activeListings ?? 0} Suits`}
            subtitle="Currently in stock"
            icon={Package}
            iconBgColor="bg-stone-100"
            iconTextColor="text-stone-700"
            loading={isLoading}
          />

          {/* STAT CARD 4: PENDING DISPATCH */}
          <ScrollableStatCard
            title="PENDING DISPATCH"
            value={`${ov?.pendingDispatch ?? 0} Orders`}
            subtitle="Requires courier booking"
            icon={Truck}
            iconBgColor="bg-amber-50"
            iconTextColor="text-amber-700"
            borderAccent="border-l-amber-500"
            onClick={onViewAllOrders}
            loading={isLoading}
          />

          {/* STAT CARD 5: DELIVERED ORDERS */}
          <ScrollableStatCard
            title="DELIVERED ORDERS"
            value={`${ov?.deliveredOrders ?? 0} Orders`}
            subtitle="Successfully completed"
            icon={CheckCircle}
            iconBgColor="bg-emerald-100"
            iconTextColor="text-emerald-800"
            loading={isLoading}
          />

          {/* STAT CARD 6: Review card */}
          <ScrollableStatCard
            title="AVG REVIEWS"
            value={`${(ov?.avgRating ?? 0).toFixed(1)} / 5`}
            subtitle="Average Rating"
            icon={Star}
            iconBgColor="bg-amber-100"
            iconTextColor="text-amber-800"
            loading={isLoading}
          />
        </HorizontalScrollRow>
      </div>

      {/* =========================================================
          SECTION 2 & SECTION 3 — LAST 7 DAYS & GRAPHS
         ========================================================= */}
      <Last7DaysSection
        dataKpi={data?.last7Kpis}
        dataDetails={data?.graphs}
        loadingKpi={isLoading}
        loadingDetails={isLoading}
        onRefresh={reload}
        onViewPendingOrders={onViewAllOrders}
      />

      {/* =========================================================
          SECTION 4 — RECENT ORDERS & DISPATCH STATUS TABLE (LIMIT 3)
         ========================================================= */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-stone-200">
          <div>
            <h3 className="text-xs sm:text-sm lg:text-base font-bold uppercase tracking-wider text-stone-900">
              Recent Orders & Dispatch Status
            </h3>
            <p className="text-[11px] text-stone-500">
              Showing top 3 most recent customer orders
            </p>
          </div>
          <button
            onClick={onViewAllOrders}
            className="text-xs sm:text-sm font-bold text-stone-900 underline hover:text-black cursor-pointer"
          >
            View All Orders →
          </button>
        </div>

        <ResponsiveTable
          columns={orderColumns}
          data={data?.recentOrders || []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          emptyTitle="No Recent Orders"
          emptySubtitle="No new customer orders have been placed yet."
          forceTableMode
        />
      </div>
    </div>
  );
};

export default DashboardOverview;
