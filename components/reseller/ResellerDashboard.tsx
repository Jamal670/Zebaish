import React from 'react';
import { useRouter } from 'next/navigation';
import DashboardOverview from './components/DashboardOverview';
import { useReseller, ResellerProvider } from './context/ResellerContext';

export interface ResellerDashboardProps {
  onLogout?: () => void;
  onNavigateHome?: () => void;
  subPath?: string;
  allReviews?: any[];
  onUpdateReviewReply?: (reviewId: string, replyText: string) => void;
  resellerStatus?: 'Active' | 'Pending Verification';
  onSimulateApproval?: () => void;
}

const ResellerDashboardInner: React.FC<ResellerDashboardProps> = () => {
  const { myListings, orders } = useReseller();
  const router = useRouter();

  return (
    <DashboardOverview
      myListingsCount={myListings.length}
      orders={orders}
      onViewAllOrders={() => router.push('/dashboard/orders')}
    />
  );
};

export const ResellerDashboard: React.FC<ResellerDashboardProps> = (props) => {
  return (
    <ResellerProvider>
      <ResellerDashboardInner {...props} />
    </ResellerProvider>
  );
};

export default ResellerDashboard;
