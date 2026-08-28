import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertCircle,
  FileText,
  UserCheck,
  PackageCheck,
  CreditCard,
  UserX,
  Clock,
  Lock,
  Database,
  Mail,
  ChevronRight,
} from 'lucide-react';

export const SellerPrivacyPolicy: React.FC = () => {
  const sections = [
    {
      id: '1',
      title: '1. Information We Collect',
      icon: FileText,
      content:
        'When you register and operate as a Seller on Zebaish, we may collect information necessary to create and manage your seller account. This may include your full name, email address, phone number, CNIC or identity information, city, address, shop name, store information, product information, order-related information, and other information required to provide seller-related services on the platform. We may also collect information about your account activity, product listings, order fulfillment, commission payments, and seller account status.',
    },
    {
      id: '2',
      title: '2. Why We Collect Seller Information',
      icon: UserCheck,
      content:
        "We collect seller information to create and maintain your seller account, verify your identity, operate the seller platform, manage your product listings and orders, process and track seller commissions, communicate important account-related information, and maintain the security and reliability of the Zebaish marketplace. Your information may also be used to monitor seller activity and determine whether your account continues to meet Zebaish's seller requirements and operational policies.",
    },
    {
      id: '3',
      title: '3. CNIC / Identity Verification',
      icon: ShieldCheck,
      content:
        'Zebaish may collect and use your CNIC or other identity information for seller identity verification and account-related verification purposes. This information helps us confirm that the seller account belongs to a legitimate individual and helps prevent fraudulent, misleading, or unauthorized seller accounts. Identity information may also be used when necessary to maintain marketplace security and comply with applicable legal or operational requirements.',
    },
    {
      id: '4',
      title: '4. Product & Order Information',
      icon: PackageCheck,
      content:
        'As a Seller, information related to your products and orders may be collected and stored as part of operating your seller account. This may include product names, descriptions, prices, images, product status, order details, order status, shipping or fulfillment activity, cancellation information, refund-related information, and other information associated with your products and customer orders. This information is necessary to manage your listings, process orders, monitor fulfillment, and provide the marketplace services offered by Zebaish.',
    },
    {
      id: '5',
      title: '5. Commission & Seller Payments',
      icon: CreditCard,
      content:
        "Zebaish calculates seller commissions on a monthly basis based on the applicable commission rules and the seller's eligible order activity during the relevant billing period. The monthly commission amount is calculated at the beginning of the applicable payment cycle, and sellers are required to complete their outstanding commission payment by the 5th day of the month. Sellers may receive reminders and payment notifications regarding outstanding commissions. If the required commission payment is not completed within the applicable payment period, Zebaish may restrict the seller's account, deactivate the seller's account, or apply other account restrictions in accordance with the platform's seller policies. Such restrictions may also affect the seller's ability to manage products and operate normally on the platform until the outstanding commission is resolved.",
    },
    {
      id: '6',
      title: '6. Seller Account Status & Restrictions',
      icon: UserX,
      content:
        'Your Zebaish seller account may have different statuses, including Active, Inactive, or Suspended, depending on your account activity and compliance with platform requirements. An account may be restricted or changed to Inactive status for reasons including unpaid commissions, failure to fulfill orders within the required timeframe, or other violations of applicable seller policies. When an account is restricted or made Inactive, certain seller functionality may be disabled, including the ability to add or modify products or perform other seller actions that require an Active account. The duration and conditions of a restriction may depend on the reason for the restriction and the applicable Zebaish policy.',
    },
    {
      id: '7',
      title: '7. Pending Orders & Seller Activity',
      icon: Clock,
      content:
        "Zebaish expects sellers to process and ship newly received orders within the required timeframe. If a Seller fails to ship eligible pending orders within 3 days, the seller account may be restricted or changed to Inactive status in accordance with the platform's seller activity policy. This restriction is intended to encourage timely order fulfillment and protect customers from unnecessary delays. Sellers may be required to resolve their pending orders or meet the applicable requirements before their seller account can regain full access to seller functionality.",
    },
    {
      id: '8',
      title: '8. Seller Data Security',
      icon: Lock,
      content:
        'Zebaish takes reasonable technical and organizational measures to protect seller information against unauthorized access, misuse, alteration, disclosure, or loss. Seller information is stored and processed using systems and security controls designed to protect account and marketplace data. However, no online system or method of electronic storage can be guaranteed to be completely secure, and sellers should also take reasonable steps to protect their account credentials and avoid sharing their login information with unauthorized individuals.',
    },
    {
      id: '9',
      title: '9. Data Retention',
      icon: Database,
      content:
        'Zebaish may retain seller information for as long as necessary to operate the seller account, maintain transaction and marketplace records, process commissions and payments, resolve disputes, maintain security, prevent fraud, comply with applicable legal or regulatory requirements, and fulfill legitimate business purposes. Certain information may therefore remain in our systems after a seller account becomes Inactive, Suspended, or is otherwise no longer actively used, where retention is reasonably necessary for these purposes.',
    },
    {
      id: '10',
      title: '10. Emails & Notifications',
      icon: Mail,
      content:
        'Zebaish may send sellers emails, notifications, or other account-related communications regarding their seller account and platform activity. These communications may include account verification messages, order-related notifications, commission calculations, payment reminders, payment deadlines, account restrictions, inactivity notices, suspension-related notifications, and other important seller communications. These notifications are intended to keep sellers informed about actions or requirements that may affect their seller account and access to the platform.',
    },
  ];

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 w-full animate-fade-in">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        

        {/* Page Header Banner */}
        <div className="bg-stone-900 text-white rounded-lg p-6 sm:p-10 mb-8 shadow-lg relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center space-x-2 text-2xs font-bold tracking-[0.3em] uppercase text-amber-400 mb-3">
            <ShieldCheck className="w-4 h-4" />
            <span>Zebaish Seller Partner Policies</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-script mb-3 text-white">
            Zebaish Seller Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
            Essential information regarding data collection, seller account management, identity verification, commissions, and account status policies on the Zebaish Marketplace.
          </p>
        </div>

        {/* Important Notice Callout Box */}
        <div className="bg-amber-500/10 border-l-4 border-amber-500 p-5 sm:p-6 rounded-r-lg mb-8 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900 mb-2">
                Important Notice for Sellers
              </h2>
              <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-normal">
                If you are registered as a Seller on the Zebaish platform, this Privacy Policy applies to you. It explains what information we collect from you, why we collect it, how it is used to operate your seller account, and how your seller activity and account status may be managed on the platform. By registering and using Zebaish as a Seller, you acknowledge and agree to the practices described in this Privacy Policy.
              </p>
            </div>
          </div>
        </div>

        {/* Policy Sections */}
        <div className="space-y-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <section
                key={section.id}
                className="bg-white border border-stone-200 rounded-lg p-5 sm:p-7 shadow-xs transition-all hover:shadow-md"
              >
                <div className="flex items-center space-x-3 mb-3 border-b border-stone-100 pb-3">
                  <div className="p-2 bg-stone-100 rounded-md text-stone-800">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-stone-900 tracking-tight">
                    {section.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-normal">
                  {section.content}
                </p>
              </section>
            );
          })}
        </div>

        {/* Support & Inquiry Card */}
        <div className="mt-10 bg-white border border-stone-200 rounded-lg p-6 text-center shadow-xs">
          <h4 className="text-sm font-bold uppercase tracking-wider text-stone-900 mb-1">
            Questions Regarding Seller Policies?
          </h4>
          <p className="text-xs text-stone-600 mb-4">
            If you have questions about your seller account or data policies, our seller support team is here to assist you.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold">
            <a
              href="mailto:help@zebaish.com"
              className="inline-flex items-center space-x-1.5 text-stone-900 hover:text-amber-600 transition-colors"
            >
              <Mail className="w-4 h-4 text-stone-500" />
              <span>help@zebaish.com</span>
            </a>
            <span className="text-stone-300">|</span>
            <span className="text-stone-700">Call: +92 316-7156734</span>
          </div>
        </div>
      </div>
    </div>
  );
};
