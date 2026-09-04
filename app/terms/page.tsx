import type { Metadata } from 'next';
import { TermsContent } from '@/components/TermsContent';

export const metadata: Metadata = {
  title: 'Zebaish Terms & Conditions | ZEBAISH',
  description: 'Comprehensive terms, buyer guidelines, seller obligations, 3-day pending order rules, commission policies, and platform rules for Zebaish Marketplace.',
};

export default function TermsPage() {
  return <TermsContent />;
}
