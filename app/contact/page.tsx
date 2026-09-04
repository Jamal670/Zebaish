import type { Metadata } from 'next';
import { ContactPage } from '@/components/ContactPage';

export const metadata: Metadata = {
  title: 'Contact Us | ZEBAISH',
  description: 'Get in touch with Zebaish customer support for inquiries about designer surplus fashion items, orders, or seller partnerships.',
};

export default function ContactUsPage() {
  return <ContactPage />;
}
