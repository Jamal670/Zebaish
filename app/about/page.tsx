import type { Metadata } from 'next';
import { AboutPage } from '@/components/AboutPage';

export const metadata: Metadata = {
  title: 'About Zebaish | Designer Surplus Marketplace',
  description: 'Learn about Zebaish, Pakistan premier online marketplace for authentic designer surplus fashion, factory clearance suits, and verified reseller stores.',
};

export default function Page() {
  return <AboutPage />;
}
