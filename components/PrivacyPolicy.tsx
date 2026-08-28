'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  FileText,
  CreditCard,
  UserX,
  Clock,
  Lock,
  Database,
  Mail,
  ArrowLeft,
  Store,
} from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in w-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Header Hero Banner */}
        <div className="bg-stone-900 text-white rounded-lg p-8 sm:p-10 mb-8 text-center shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="inline-flex items-center space-x-2 bg-amber-400/10 text-amber-400 px-3.5 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-4 border border-amber-400/20">
            <ShieldCheck className="w-4 h-4" />
            <span>Platform Policy</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-script mb-3 text-white">
            Zebaish Seller Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-2xl mx-auto leading-relaxed">
            Essential information regarding data collection, seller account operations, verification, and platform security for Zebaish seller partners.
          </p>
        </div>

        {/* Important Notice */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 mb-8 text-amber-900 shadow-sm relative overflow-hidden">
          <div className="flex items-start space-x-3 sm:space-x-4">
            <div className="p-2 bg-amber-500/20 rounded-md text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-amber-950 uppercase tracking-wide">
                Important Notice for Sellers
              </h2>
              <p className="text-xs sm:text-sm text-stone-800 leading-relaxed">
                If you are registered as a Seller on the Zebaish platform, this Privacy Policy applies to you. It explains what information we collect from you, why we collect it, how it is used to operate your seller account, and how your seller activity and account status may be managed on the platform. By registering and using Zebaish as a Seller, you acknowledge and agree to the practices described in this Privacy Policy.
              </p>
            </div>
          </div>
        </div>

        {/* Policy Content Container */}
        <div className="bg-white border border-stone-200 rounded-lg p-6 sm:p-10 shadow-sm space-y-10">

          {/* Section 1 */}
          <section className="space-y-3 pb-8 border-b border-stone-100">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                1
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Information We Collect</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              When you register and operate as a Seller on Zebaish, we may collect information necessary to create and manage your seller account. This may include your full name, email address, phone number, CNIC or identity information, city, address, shop name, store information, product information, order-related information, and other information required to provide seller-related services on the platform. We may also collect information about your account activity, product listings, order fulfillment, commission payments, and seller account status.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 pb-8 border-b border-stone-100">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                2
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <Store className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Why We Collect Seller Information</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              We collect seller information to create and maintain your seller account, verify your identity, operate the seller platform, manage your product listings and orders, process and track seller commissions, communicate important account-related information, and maintain the security and reliability of the Zebaish marketplace. Your information may also be used to monitor seller activity and determine whether your account continues to meet Zebaish's seller requirements and operational policies.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pb-8 border-b border-stone-100">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                3
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>CNIC / Identity Verification</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              Zebaish may collect and use your CNIC or other identity information for seller identity verification and account-related verification purposes. This information helps us confirm that the seller account belongs to a legitimate individual and helps prevent fraudulent, misleading, or unauthorized seller accounts. Identity information may also be used when necessary to maintain marketplace security and comply with applicable legal or operational requirements.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 pb-8 border-b border-stone-100">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                4
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Product & Order Information</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              As a Seller, information related to your products and orders may be collected and stored as part of operating your seller account. This may include product names, descriptions, prices, images, product status, order details, order status, shipping or fulfillment activity, cancellation information, refund-related information, and other information associated with your products and customer orders. This information is necessary to manage your listings, process orders, monitor fulfillment, and provide the marketplace services offered by Zebaish.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 pb-8 border-b border-stone-100">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                5
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Commission & Seller Payments</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              Zebaish calculates seller commissions on a monthly basis based on the applicable commission rules and the seller's eligible order activity during the relevant billing period. The monthly commission amount is calculated at the beginning of the applicable payment cycle, and sellers are required to complete their outstanding commission payment by the 5th day of the month. Sellers may receive reminders and payment notifications regarding outstanding commissions. If the required commission payment is not completed within the applicable payment period, Zebaish may restrict the seller's account, deactivate the seller's account, or apply other account restrictions in accordance with the platform's seller policies. Such restrictions may also affect the seller's ability to manage products and operate normally on the platform until the outstanding commission is resolved.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pb-8 border-b border-stone-100">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                6
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <UserX className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Seller Account Status & Restrictions</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              Your Zebaish seller account may have different statuses, including Active, Inactive, or Suspended, depending on your account activity and compliance with platform requirements. An account may be restricted or changed to Inactive status for reasons including unpaid commissions, failure to fulfill orders within the required timeframe, or other violations of applicable seller policies. When an account is restricted or made Inactive, certain seller functionality may be disabled, including the ability to add or modify products or perform other seller actions that require an Active account. The duration and conditions of a restriction may depend on the reason for the restriction and the applicable Zebaish policy.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 pb-8 border-b border-stone-100">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                7
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Pending Orders & Seller Activity</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              Zebaish expects sellers to process and ship newly received orders within the required timeframe. If a Seller fails to ship eligible pending orders within 3 days, the seller account may be restricted or changed to Inactive status in accordance with the platform's seller activity policy. This restriction is intended to encourage timely order fulfillment and protect customers from unnecessary delays. Sellers may be required to resolve their pending orders or meet the applicable requirements before their seller account can regain full access to seller functionality.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3 pb-8 border-b border-stone-100">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                8
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Seller Data Security</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              Zebaish takes reasonable technical and organizational measures to protect seller information against unauthorized access, misuse, alteration, disclosure, or loss. Seller information is stored and processed using systems and security controls designed to protect account and marketplace data. However, no online system or method of electronic storage can be guaranteed to be completely secure, and sellers should also take reasonable steps to protect their account credentials and avoid sharing their login information with unauthorized individuals.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3 pb-8 border-b border-stone-100">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                9
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <Database className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Data Retention</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              Zebaish may retain seller information for as long as necessary to operate the seller account, maintain transaction and marketplace records, process commissions and payments, resolve disputes, maintain security, prevent fraud, comply with applicable legal or regulatory requirements, and fulfill legitimate business purposes. Certain information may therefore remain in our systems after a seller account becomes Inactive, Suspended, or is otherwise no longer actively used, where retention is reasonably necessary for these purposes.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center border border-stone-200 shrink-0">
                10
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center space-x-2">
                <Mail className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Emails & Notifications</span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed sm:pl-11">
              Zebaish may send sellers emails, notifications, or other account-related communications regarding their seller account and platform activity. These communications may include account verification messages, order-related notifications, commission calculations, payment reminders, payment deadlines, account restrictions, inactivity notices, suspension-related notifications, and other important seller communications. These notifications are intended to keep sellers informed about actions or requirements that may affect their seller account and access to the platform.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

