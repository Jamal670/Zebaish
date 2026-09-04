'use client';

import React from 'react';
import {
  ShieldCheck,
  UserCheck,
  FileText,
  Sliders,
  ExternalLink,
  Lock,
  Database,
  Cookie,
  RefreshCw,
  Mail,
  HeartHandshake,
} from 'lucide-react';
import { LegalPageLayout, LegalSection } from '@/components/LegalPageLayout';

export const CustomerPrivacyContent: React.FC = () => {
  const sections: LegalSection[] = [
    {
      id: 'customer-info-collect',
      title: 'Information We Collect From Customers',
      icon: <FileText className="w-5 h-5" />,
      content: (
        <>
          <p>
            When you browse, create a customer account, save items to your cart, or place orders on Zebaish, we collect information necessary to fulfill your purchases and provide a seamless marketplace experience. This includes:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li><strong>Personal &amp; Account Information:</strong> Your full name, email address, phone number, and password credentials when registering an account.</li>
            <li><strong>Delivery &amp; Shipping Address:</strong> Full recipient name, street address, city, and postal code required to dispatch and deliver your purchases across Pakistan.</li>
            <li><strong>Order &amp; Purchase History:</strong> Details of items purchased, prices, order timestamps, payment methods selected, order status, and transaction references.</li>
            <li><strong>Cart &amp; Wishlist Activity:</strong> Items added to your shopping cart, saved items, and browsing preferences.</li>
            <li><strong>Reviews &amp; Ratings Submitted:</strong> Feedback, star ratings, product comments, and reviews provided for sellers or products.</li>
            <li><strong>Customer Support Communications:</strong> Messages, queries, or complaints sent to Zebaish support via email, phone, or WhatsApp.</li>
            <li><strong>Payment Information Handling:</strong> Zebaish supports Cash on Delivery, JazzCash, EasyPaisa, and Bank Card payments. Payment transactions are processed directly through secure third-party payment providers and financial gateways. <span className="font-semibold text-stone-900">Zebaish does not collect or store full debit/credit card numbers or banking passwords on platform servers.</span></li>
          </ul>
        </>
      ),
    },
    {
      id: 'how-we-use-info',
      title: 'How We Use Customer Information',
      icon: <Sliders className="w-5 h-5" />,
      content: (
        <>
          <p>
            We use customer information strictly for legitimate operational, fulfillment, and customer care purposes, including:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li><strong>Order Processing &amp; Fulfillment:</strong> Transmitting necessary shipping details to sellers and courier partners to package, ship, and deliver your orders accurately.</li>
            <li><strong>Payment Processing:</strong> Verifying order payments and facilitating refund or exchange transactions where applicable.</li>
            <li><strong>Notifications &amp; Account Emails:</strong> Sending essential transaction updates, order confirmations, shipping dispatch alerts, tracking info, and account-related notices.</li>
            <li><strong>Fraud Prevention &amp; Platform Security:</strong> Detecting and preventing unauthorized logins, fraudulent checkout attempts, spam reviews, or platform abuse.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'third-party-integrations',
      title: 'Third-Party Services & Integrations',
      icon: <ExternalLink className="w-5 h-5" />,
      content: (
        <>
          <p>
            Zebaish works with trusted third-party infrastructure and service partners to operate our marketplace. We share customer information only to the extent necessary to perform specific services:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li><strong>Supabase Infrastructure:</strong> Cloud backend authentication, secure encrypted database storage, and file hosting.</li>
            <li><strong>Payment Gateways &amp; Banking Partners:</strong> Financial institutions processing Cash on Delivery reconciliations, JazzCash, EasyPaisa, and Bank Card transactions.</li>
            <li><strong>Logistic &amp; Courier Services:</strong> Nationwide delivery services carrying customer delivery addresses and phone numbers to complete package drop-offs.</li>
          </ul>
          <p>
            We do not sell, rent, or trade customer personal data to third-party advertisers or marketing agencies.
          </p>
        </>
      ),
    },
    {
      id: 'data-security',
      title: 'Data Security',
      icon: <Lock className="w-5 h-5" />,
      content: (
        <>
          <p>
            Zebaish implements robust technical and organizational security measures to protect customer data against unauthorized access, loss, alteration, or disclosure. This includes SSL/TLS encryption for data in transit, role-based database access controls, and secure authentication protocols via Supabase.
          </p>
          <p>
            While we take rigorous measures to safeguard your personal data, no internet transmission or electronic storage system is 100% secure. Customers are advised to maintain strong passwords and avoid sharing login credentials.
          </p>
        </>
      ),
    },
    {
      id: 'data-retention',
      title: 'Data Retention',
      icon: <Database className="w-5 h-5" />,
      content: (
        <>
          <p>
            We retain customer personal information for as long as your account remains active or as needed to provide services, fulfill past orders, maintain legal and tax records, resolve disputes, and enforce our marketplace policies.
          </p>
          <p>
            When customer data is no longer required for operational or legal purposes, it is securely deleted or anonymized.
          </p>
        </>
      ),
    },
    {
      id: 'customer-privacy-rights',
      title: 'Customer Privacy Rights',
      icon: <UserCheck className="w-5 h-5" />,
      content: (
        <>
          <p>
            Zebaish respects your rights regarding your personal data. As a customer, you have the right to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li><strong>Access &amp; Review:</strong> Request a copy of the personal information Zebaish holds about you.</li>
            <li><strong>Correction &amp; Updates:</strong> Update or correct your profile details, phone number, or delivery addresses directly through your Account settings or support.</li>
            <li><strong>Account Deletion:</strong> Request the closure of your customer account and deletion of associated personal data (subject to legal or order retention requirements).</li>
          </ul>
          <p>
            To submit a privacy request, please contact our support team at <a href="mailto:help@zebaish.com" className="text-amber-800 underline hover:text-stone-900">help@zebaish.com</a> with your registered email address.
          </p>
        </>
      ),
    },
    {
      id: 'cookies-analytics',
      title: 'Cookies & Tracking Technologies',
      icon: <Cookie className="w-5 h-5" />,
      content: (
        <>
          <p>
            Zebaish uses essential local storage and session tokens strictly necessary for account authentication, maintaining items in your shopping cart, and remembering user preferences across page views.
          </p>
          <p>
            <span className="font-semibold text-stone-900">Zebaish does not currently use third-party advertising cookies, ad-tracking pixels, or cross-site profiling scripts.</span> Any changes to our use of cookies will be communicated through an updated policy.
          </p>
        </>
      ),
    },
    {
      id: 'policy-updates',
      title: 'Privacy Policy Updates',
      icon: <RefreshCw className="w-5 h-5" />,
      content: (
        <>
          <p>
            We may update this Buyer Privacy Policy from time to time to reflect changes in our data practices, services, or legal obligations. The latest version will always be accessible at this page, with the updated revision date posted.
          </p>
        </>
      ),
    },
    {
      id: 'contact-info',
      title: 'Contact Information',
      icon: <Mail className="w-5 h-5" />,
      content: (
        <>
          <p>
            If you have questions, concerns, or privacy requests regarding your customer information, please contact us at:
          </p>
          <div className="bg-stone-50 border border-stone-200 rounded-md p-4 space-y-1 text-stone-800 font-medium text-xs sm:text-sm">
            <p className="font-semibold text-stone-900">Zebaish Privacy Team</p>
            <p>Address: 5.5 KM, Raiwind Road (Near Fatehbad Village), Lahore, Pakistan</p>
            <p>Phone: +92 316 7156734</p>
            <p>WhatsApp: +92 316 7156734</p>
            <p>Email: <a href="mailto:help@zebaish.com" className="text-amber-800 underline hover:text-stone-900">help@zebaish.com</a></p>
          </div>
        </>
      ),
    },
  ];

  return (
    <LegalPageLayout
      badgeIcon={<ShieldCheck className="w-4 h-4" />}
      badgeText="Customer Data Policy"
      title="Buyer Privacy Policy"
      subtitle="How Zebaish protects customer personal data, handles order information, and respects buyer privacy rights."
      noticeTitle="Dedicated Privacy Policy for Zebaish Customers"
      noticeIcon={<HeartHandshake className="w-5 h-5 sm:w-6 sm:h-6" />}
      noticeContent={
        <p>
          This Privacy Policy applies specifically to customers and buyers using Zebaish to browse, save items, or purchase products. It outlines how your personal data is collected, used, and protected during your shopping journey on Zebaish.
        </p>
      }
      sections={sections}
    />
  );
};

export default CustomerPrivacyContent;
