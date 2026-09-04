'use client';

import React from 'react';
import {
  FileText,
  UserCheck,
  ShoppingBag,
  Store,
  Tag,
  PackageCheck,
  Clock,
  CreditCard,
  UserX,
  RefreshCw,
  AlertTriangle,
  Ban,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  ShieldAlert,
  Edit,
  Gavel,
  Mail,
} from 'lucide-react';
import { LegalPageLayout, LegalSection } from '@/components/LegalPageLayout';

export const TermsContent: React.FC = () => {
  const sections: LegalSection[] = [
    {
      id: 'introduction',
      title: 'Introduction',
      icon: <FileText className="w-5 h-5" />,
      content: (
        <>
          <p>
            Welcome to Zebaish (referred to herein as &quot;Zebaish,&quot; &quot;the Platform,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). Zebaish operates as Pakistan&apos;s premier designer leftover stock hub and online multi-seller marketplace, connecting buyers with authentic designer fashion, leftover fabrics, boutique items, and independent sellers across Pakistan.
          </p>
          <p>
            These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of the Zebaish website, mobile interfaces, seller dashboard, and related services. By accessing, browsing, registering an account, purchasing products, or listing items as a seller on Zebaish, you acknowledge that you have read, understood, and agree to be bound by these Terms in full.
          </p>
        </>
      ),
    },
    {
      id: 'eligibility-accounts',
      title: 'Eligibility & User Accounts',
      icon: <UserCheck className="w-5 h-5" />,
      content: (
        <>
          <p>
            To register an account or use services on Zebaish, you must be at least 18 years of age or possess legal capacity under the laws of Pakistan to enter into binding agreements. If you register an account on behalf of a business entity, you represent and warrant that you possess the authority to bind that entity to these Terms.
          </p>
          <p>
            You are responsible for providing accurate, current, and complete registration information (including name, email address, mobile number, and delivery or store details) and for maintaining the confidentiality of your account credentials. You accept full responsibility for all activities occurring under your account credentials. You must immediately notify Zebaish support of any unauthorized use or security breach.
          </p>
        </>
      ),
    },
    {
      id: 'buyer-terms',
      title: 'Buyer Terms',
      icon: <ShoppingBag className="w-5 h-5" />,
      content: (
        <>
          <p>
            Buyers can browse products, add items to their shopping cart, and place orders through the Zebaish checkout process. When placing an order, buyers agree that:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li>Placing an order constitutes an offer to purchase the specified item(s) at the listed price, plus applicable delivery charges.</li>
            <li>Accurate shipping addresses and contact details must be provided at checkout. Zebaish and its sellers are not responsible for delivery failures caused by incorrect customer addresses or unreachable phone numbers.</li>
            <li>Buyers agree to inspect delivered packages upon receipt and follow platform guidance for any delivery discrepancies or damaged items.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'seller-terms',
      title: 'Seller Terms',
      icon: <Store className="w-5 h-5" />,
      content: (
        <>
          <p>
            Independent merchants and boutique owners may apply to become registered sellers on Zebaish. To qualify and remain an active seller partner, sellers must complete identity verification (including providing a valid Pakistani CNIC number and CNIC document images) and adhere to platform standards.
          </p>
          <p>
            Sellers act as independent business partners and are solely responsible for the authenticity, legal ownership, quality, inventory levels, accurate descriptions, and prompt fulfillment of the products they offer on Zebaish.
          </p>
        </>
      ),
    },
    {
      id: 'product-listing-rules',
      title: 'Seller Product Listing Rules',
      icon: <Tag className="w-5 h-5" />,
      content: (
        <>
          <p>
            All product listings published on Zebaish must adhere to high standards of quality and accuracy. Sellers must comply with the following listing guidelines:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li><strong>Authenticity &amp; Accuracy:</strong> Listings must accurately depict the product title, brand, fabric composition, color, size, condition (e.g. leftover stock, original boutique piece), and price.</li>
            <li><strong>Stock Availability:</strong> Sellers must only list items that are currently in stock and available for immediate dispatch. Listing out-of-stock items is prohibited.</li>
            <li><strong>Clear Product Images:</strong> Listings must include clear, representative photos of the actual product being sold. Misleading or deceptive imagery is prohibited.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'orders-fulfillment',
      title: 'Orders & Order Fulfillment',
      icon: <PackageCheck className="w-5 h-5" />,
      content: (
        <>
          <p>
            Once a buyer completes checkout, relevant order details are transmitted to the respective seller(s) for processing and dispatch. Sellers are expected to pack and dispatch orders through verified courier channels in a timely manner.
          </p>
          <p>
            Zebaish provides order status tracking for buyers and sellers. Order status milestones (e.g., Pending, Processing, Shipped, Delivered, Cancelled) reflect real-time updates provided by sellers and logistic partners.
          </p>
        </>
      ),
    },
    {
      id: 'pending-order-requirement',
      title: 'Seller 3-Day Pending-Order Requirement',
      icon: <Clock className="w-5 h-5" />,
      content: (
        <>
          <p>
            To maintain high customer satisfaction and prevent order delays, Zebaish enforces a strict <strong>3-Day Pending-Order Requirement</strong> for all seller partners.
          </p>
          <p>
            When a seller receives a customer order, the seller must action, pack, and dispatch the pending order within 3 calendar days. If a seller fails to fulfill eligible pending orders within 3 days:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li>The system automatically sets the seller&apos;s pending-order restriction status flag (<code className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">pending_orders_inactive</code>) to active.</li>
            <li>The seller account status will be restricted or changed to <span className="font-semibold text-stone-900">Inactive</span>, disabling product listing management and storefront operational features.</li>
            <li>Account access will remain restricted until the seller completes dispatch of outstanding pending orders or resolves the pending order backlog with Zebaish operations.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'commission-payments',
      title: 'Seller Commission & Payment Obligations',
      icon: <CreditCard className="w-5 h-5" />,
      content: (
        <>
          <p>
            Zebaish operates on a transparent commission model. Sellers agree to pay Zebaish the applicable commission on sales generated through the marketplace.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li><strong>Monthly Calculation:</strong> Seller commission dues are calculated monthly based on eligible completed orders during the preceding billing period.</li>
            <li><strong>Payment Deadline:</strong> Outstanding monthly commission payments must be remitted by the 5th day of each calendar month.</li>
            <li><strong>Overdue Dues:</strong> If a seller fails to pay required commission dues by the deadline, the system automatically sets the seller commission restriction flag (<code className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">commission_inactive</code>) to active.</li>
            <li><strong>Account Impact:</strong> The seller&apos;s account will be restricted to <span className="font-semibold text-stone-900">Inactive</span> status, preventing product management actions until all outstanding commission amounts are fully paid and verified.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'account-status-restrictions',
      title: 'Account Status, Restrictions, Inactive/Suspended Accounts',
      icon: <UserX className="w-5 h-5" />,
      content: (
        <>
          <p>
            Zebaish seller accounts maintain specific operational statuses based on compliance with platform rules:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li><span className="font-semibold text-emerald-700">Active:</span> Full access to list products, receive orders, and operate storefront.</li>
            <li><span className="font-semibold text-amber-700">Inactive:</span> Restricted state triggered by unpaid commissions (<code className="text-stone-800 bg-stone-100 px-1 py-0.5 rounded">commission_inactive</code>), delayed 3-day pending order backlog (<code className="text-stone-800 bg-stone-100 px-1 py-0.5 rounded">pending_orders_inactive</code>), or temporary store pause. Product creation and listing updates are disabled during Inactive status.</li>
            <li><span className="font-semibold text-red-700">Suspended:</span> Formally restricted or suspended state (<code className="text-stone-800 bg-stone-100 px-1 py-0.5 rounded">status: Suspended</code>, with optional restriction deadline <code className="text-stone-800 bg-stone-100 px-1 py-0.5 rounded">restricted_until</code>) resulting from serious policy violations, counterfeit listings, or unverified identity credentials. Suspended sellers are barred from marketplace operations.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'cancellation-returns-refunds',
      title: 'Cancellation, Returns & Refunds',
      icon: <RefreshCw className="w-5 h-5" />,
      content: (
        <>
          <p>
            Buyers may request order cancellations prior to dispatch. Once an order is shipped, standard marketplace return and exchange guidelines apply:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li><strong>Eligible Claims:</strong> Returns or replacement requests may be initiated for defective items, wrong products received, or items significantly different from their published store description.</li>
            <li><strong>Condition:</strong> Items must be returned unused, unwashed, with original tags, fabric cuts intact, and in original packaging.</li>
            <li><strong>Resolution:</strong> Valid return claims are processed for replacement or refund according to seller exchange terms and Zebaish customer protection guidelines.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'pricing-errors',
      title: 'Product Information & Pricing Errors',
      icon: <AlertTriangle className="w-5 h-5" />,
      content: (
        <>
          <p>
            While Zebaish and seller partners strive to ensure accurate pricing, stock availability, and specifications, inadvertent typographical or technical pricing errors may occasionally occur.
          </p>
          <p>
            Zebaish reserves the right to correct pricing or product errors and to cancel or decline orders placed for products listed at an incorrect price due to technical glitches or typographical errors, prior to shipment confirmation.
          </p>
        </>
      ),
    },
    {
      id: 'prohibited-products',
      title: 'Prohibited Products & Prohibited Activities',
      icon: <Ban className="w-5 h-5" />,
      content: (
        <>
          <p>
            Users and sellers are strictly prohibited from engaging in illegal, fraudulent, or harmful activities on Zebaish. Prohibited activities and product listings include:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
            <li>Listing counterfeit products, unauthorized brand replicas, or stolen goods.</li>
            <li>Publishing false, misleading, defamatory, or deceptive listing information or seller reviews.</li>
            <li>Manipulating prices, circumvention of platform commission, or off-platform payment solicitations.</li>
            <li>Attempting unauthorized access to Zebaish systems, customer data, or API endpoints.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'reviews-content',
      title: 'Reviews & User-Generated Content',
      icon: <MessageSquare className="w-5 h-5" />,
      content: (
        <>
          <p>
            Buyers who have completed purchases on Zebaish may submit product reviews and star ratings. User-generated reviews foster trust across our marketplace.
          </p>
          <p>
            All submitted reviews undergo moderation (<code className="text-stone-800 bg-stone-100 px-1 py-0.5 rounded">reviews.status</code>: Pending / Approved / Rejected). Zebaish reserves the right to reject, edit, or remove reviews that contain abusive language, personal contact info, spam, promotional links, or unsubstantiated claims.
          </p>
        </>
      ),
    },
    {
      id: 'intellectual-property',
      title: 'Intellectual Property, Copyright & Trademarks',
      icon: <ShieldCheck className="w-5 h-5" />,
      content: (
        <>
          <p>
            All content on the Zebaish platform — including logos, brand artwork, visual layout, graphics, text, software code, and platform design — is the exclusive property of Zebaish or its licensors and is protected under copyright, trademark, and intellectual property laws of Pakistan.
          </p>
          <p>
            Seller logos, brand names, and product imagery remain the property of their respective owners. Sellers warrant that they possess all necessary rights to publish their product imagery and content on Zebaish.
          </p>
        </>
      ),
    },
    {
      id: 'third-party-services',
      title: 'Third-Party Services',
      icon: <ExternalLink className="w-5 h-5" />,
      content: (
        <>
          <p>
            Zebaish integrates trusted third-party infrastructure and service providers to power its marketplace operations, including Supabase backend authentication and database infrastructure, payment service providers (JazzCash, EasyPaisa, Bank Card processors), and courier delivery services across Pakistan.
          </p>
          <p>
            Your interactions with third-party providers are subject to their respective terms of service and privacy policies where applicable.
          </p>
        </>
      ),
    },
    {
      id: 'disclaimer-limitation',
      title: 'Disclaimer & Limitation of Liability',
      icon: <ShieldAlert className="w-5 h-5" />,
      content: (
        <>
          <p>
            Zebaish provides its marketplace platform on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. While we maintain rigorous platform security and verification standards, Zebaish makes no warranties, express or implied, regarding uninterrupted site access or seller-managed product availability.
          </p>
          <p>
            To the maximum extent permitted by applicable law in Pakistan, Zebaish shall not be liable for indirect, incidental, punitive, or consequential damages resulting from platform use, delayed courier deliveries, or seller listing errors.
          </p>
        </>
      ),
    },
    {
      id: 'changes-to-terms',
      title: 'Changes to Terms',
      icon: <Edit className="w-5 h-5" />,
      content: (
        <>
          <p>
            Zebaish reserves the right to modify or update these Terms at any time to reflect platform enhancements, legal compliance updates, or operational changes. Updated versions will be posted on this page with a revised effective date. Continued use of the platform following any modifications constitutes acceptance of the revised Terms.
          </p>
        </>
      ),
    },
    {
      id: 'governing-law',
      title: 'Governing Law / Dispute Resolution',
      icon: <Gavel className="w-5 h-5" />,
      content: (
        <>
          <p>
            These Terms &amp; Conditions shall be governed by, construed, and enforced in accordance with the laws of the Islamic Republic of Pakistan.
          </p>
          <p>
            Any legal dispute, claim, or controversy arising out of or relating to these Terms or platform operations shall be subject to the exclusive jurisdiction of the competent courts located in Lahore, Pakistan.
          </p>
        </>
      ),
    },
    {
      id: 'contact-information',
      title: 'Contact Information',
      icon: <Mail className="w-5 h-5" />,
      content: (
        <>
          <p>
            If you have questions, feedback, or legal inquiries regarding these Terms &amp; Conditions, please reach out to Zebaish support:
          </p>
          <div className="bg-stone-50 border border-stone-200 rounded-md p-4 space-y-1 text-stone-800 font-medium text-xs sm:text-sm">
            <p className="font-semibold text-stone-900">Zebaish Marketplace Support</p>
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
      badgeIcon={<FileText className="w-4 h-4" />}
      badgeText="Marketplace Agreement"
      title="Terms & Conditions"
      subtitle="Comprehensive rules, buyer guidelines, seller obligations, and platform policies for using Zebaish Marketplace."
      noticeTitle="Important Notice for Platform Users & Sellers"
      noticeIcon={<AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />}
      noticeContent={
        <p>
          By accessing or using the Zebaish platform as a buyer or registered seller, you agree to comply with all terms and conditions set forth herein. Please read these sections carefully to understand your rights, responsibilities, and seller operational requirements.
        </p>
      }
      sections={sections}
    />
  );
};

export default TermsContent;
