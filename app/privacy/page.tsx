import type { Metadata } from 'next';
import { CustomerPrivacyContent } from '@/components/CustomerPrivacyContent';

export const metadata: Metadata = {
  title: 'Zebaish Customer Privacy Policy | ZEBAISH',
  description: 'Complete information regarding customer data collection, order privacy, payment security, and data protection guidelines for Zebaish buyers.',
};

export default function CustomerPrivacyPage() {
  return <CustomerPrivacyContent />;
}
