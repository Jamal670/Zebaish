import React from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { OrdersTable } from './OrdersTable';

export interface OrdersViewProps {
  sellerId?: string;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ sellerId }) => {
  const { resellerProfile, user } = useAuth();

  // Determine current seller ID dynamically from resellerProfile or logged-in user ID
  const currentSellerId = sellerId || resellerProfile?.id || user?.id || 'reseller-1';

  return <OrdersTable sellerId={currentSellerId} />;
};

export default OrdersView;
