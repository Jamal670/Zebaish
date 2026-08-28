import type { Metadata } from 'next';
import { PrivacyPolicy } from '@/components/PrivacyPolicy';

export const metadata: Metadata = {
  title: 'Zebaish Seller Privacy Policy | ZEBAISH',
  description: 'Complete privacy policy, identity verification rules, data protection guidelines, and terms for Zebaish seller partners.',
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicy />;
}
