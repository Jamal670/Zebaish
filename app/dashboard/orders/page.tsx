'use client';

import React from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { OrdersView } from '@/components/reseller/components/OrdersView';

export default function OrdersPage() {
  const { resellerProfile } = useAuth();
  return <OrdersView sellerId={resellerProfile?.id} />;
}
