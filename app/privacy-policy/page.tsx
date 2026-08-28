import type { Metadata } from 'next';
import { SellerPrivacyPolicy } from '@/components/SellerPrivacyPolicy';

export const metadata: Metadata = {
  title: 'Zebaish Seller Privacy Policy | ZEBAISH',
  description:
    'Zebaish Seller Privacy Policy detailing data collection, CNIC identity verification, seller commissions, order fulfillment policies, and account status management for marketplace sellers.',
};

export default function PrivacyPolicyPage() {
  return <SellerPrivacyPolicy />;
}
