import React from 'react';
import { TrendingUp, Package, Truck, Wallet, CheckCircle, Star } from 'lucide-react';
import { Order } from '@/types';
import { Last7DaysSection } from './Last7DaysSection';
import { ResponsiveTable, ColumnDef } from './common/ResponsiveTable';
import { ScrollableStatCard } from './common/ScrollableStatCard';
import { HorizontalScrollRow } from './common/HorizontalScrollRow';
import { useSellerOverviewKpis, useSellerOverviewDetails } from '@/src/hooks/useSellerOverview';
import { RecentOrderItem } from '@/src/api/sellerOverviewService';

interface DashboardOverviewProps {
  sellerId?: string;
  myListingsCount?: number;
  orders?: Order[];
  onViewAllOrders: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  sellerId,
  onViewAllOrders,
}) => {
  // Phase 1: Fast KPI numbers (renders immediately)
  const {
    kpis,
    loading: loadingKpis,
    error: errorKpis,
    refetch: refetchKpis,
  } = useSellerOverviewKpis(sellerId);

  // Phase 2: Graphs & Recent Orders details (renders into skeletons)
  const {
    details,
    loading: loadingDetails,
    error: errorDetails,
    refetch: refetchDetails,
  } = useSellerOverviewDetails(sellerId);

  const sec1 = kpis?.section1_kpis;

  const handleRefreshAll = async () => {
    await Promise.all([refetchKpis(), refetchDetails()]);
  };

  const orderColumns: ColumnDef<RecentOrderItem>[] = [
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
          Rs. {(row.seller_total || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Dispatch Status',
      cell: (row) => {
        const isDelivered = row.status === 'Delivered';
        const isShipped = row.status === 'Shipped';
        const isPending = row.status === 'Pending' || row.status === 'Confirmed';

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
            value={`Rs. ${(sec1?.total_revenue || 0).toLocaleString()}`}
            subtitle="Generated from platform sales"
            icon={TrendingUp}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-700"
            loading={loadingKpis}
          />

          {/* STAT CARD 2: AVAILABLE PAYOUT */}
          <ScrollableStatCard
            title="AVAILABLE PAYOUT"
            value={`Rs. ${(sec1?.available_payout || 0).toLocaleString()}`}
            subtitle="Pending bank transfer"
            icon={Wallet}
            iconBgColor="bg-amber-100"
            iconTextColor="text-amber-900"
            loading={loadingKpis}
          />

          {/* STAT CARD 3: ACTIVE LISTINGS */}
          <ScrollableStatCard
            title="ACTIVE LISTINGS"
            value={`${sec1?.active_listings || 0} Suits`}
            subtitle="Currently in stock"
            icon={Package}
            iconBgColor="bg-stone-100"
            iconTextColor="text-stone-700"
            loading={loadingKpis}
          />

          {/* STAT CARD 4: PENDING DISPATCH */}
          <ScrollableStatCard
            title="PENDING DISPATCH"
            value={`${sec1?.pending_dispatch || 0} Orders`}
            subtitle="Requires courier booking"
            icon={Truck}
            iconBgColor="bg-amber-50"
            iconTextColor="text-amber-700"
            borderAccent="border-l-amber-500"
            onClick={onViewAllOrders}
            loading={loadingKpis}
          />

          {/* STAT CARD 5: DELIVERED ORDERS */}
          <ScrollableStatCard
            title="DELIVERED ORDERS"
            value={`${sec1?.delivered_orders || 0} Orders`}
            subtitle="Successfully completed"
            icon={CheckCircle}
            iconBgColor="bg-emerald-100"
            iconTextColor="text-emerald-800"
            loading={loadingKpis}
          />

          {/* STAT CARD 6: Review card */}
          <ScrollableStatCard
            title="AVG REVIEWS"
            value={`${(sec1?.average_rating ?? 0).toFixed(1)} / 5`}
            subtitle="Average Rating"
            icon={Star}
            iconBgColor="bg-amber-100"
            iconTextColor="text-amber-800"
            loading={loadingKpis}
          />
        </HorizontalScrollRow>
      </div>

      {/* =========================================================
          SECTION 2 & SECTION 3 — LAST 7 DAYS & GRAPHS
         ========================================================= */}
      <Last7DaysSection
        dataKpi={kpis?.section2_last_7d}
        dataDetails={details?.graphs}
        loadingKpi={loadingKpis}
        loadingDetails={loadingDetails}
        error={errorKpis || errorDetails}
        onRefresh={handleRefreshAll}
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
          data={details?.recent_orders || []}
          keyExtractor={(r) => r.id}
          isLoading={loadingDetails}
          emptyTitle="No Recent Orders"
          emptySubtitle="No new customer orders have been placed yet."
          forceTableMode
        />
      </div>
    </div>
  );
};

export default DashboardOverview;
