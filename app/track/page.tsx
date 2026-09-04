import type { Metadata } from 'next';
import { TrackOrderPage } from '@/components/TrackOrderPage';

export const metadata: Metadata = {
  title: 'Track Your Order | ZEBAISH',
  description: 'Track your Zebaish order status, view shipment updates, and item summaries using your Order ID.',
};

export default function TrackPage() {
  return <TrackOrderPage />;
}
