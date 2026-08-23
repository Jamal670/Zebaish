'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useReseller } from '@/components/reseller/context/ResellerContext';
import { DashboardOverview } from '@/components/reseller/components/DashboardOverview';

export default function OverviewPage() {
  const { myListings, orders } = useReseller();
  const router = useRouter();

  return (
    <DashboardOverview
      myListingsCount={myListings.length}
      orders={orders}
      onViewAllOrders={() => router.push('/dashboard/orders')}
    />
  );
}
