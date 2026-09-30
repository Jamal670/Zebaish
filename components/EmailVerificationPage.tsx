'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useApp } from '@/components/context/AppContext';

interface EmailVerificationPageProps {
  email?: string;
  onNavigateHome?: () => void;
}

export const EmailVerificationPage: React.FC<EmailVerificationPageProps> = ({
  email,
  onNavigateHome,
}) => {
  const {
    cartItems,
    wishlistIds,
    setIsMegaMenuOpen,
    setIsSearchOpen,
    setIsCartOpen,
  } = useApp();

  return (
    <div className="bg-stone-50 min-h-screen text-stone-900 pb-20 animate-fade-in w-full font-sans">
      

      <div className="max-w-md mx-auto px-4 pt-24 sm:pt-28">
        <div className="bg-white border border-stone-200 rounded-lg p-8 sm:p-10 shadow-sm text-center">
          <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600 shadow-xs">
            <Mail className="w-7 h-7" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mb-4 tracking-tight">
            Check Your Email
          </h1>

          <div className="bg-amber-50/60 border border-amber-200/80 rounded-md p-4 mb-6 text-left text-xs leading-relaxed text-stone-800">
            <p className="font-bold text-stone-900 mb-1">
              A verification email has been sent to your email address.
            </p>
            <p className="text-stone-600">
              Please open your email and click the verification link to verify your account.
            </p>
          </div>

          {email && (
            <div className="mb-6 p-2.5 bg-stone-100 rounded text-xs text-stone-600 font-mono break-all">
              Sent to: {email}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Link
              href="/login"
              className="w-full py-3.5 bg-stone-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-md shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer block"
            >
              <span>Back to Login</span>
              <ArrowRight className="w-4 h-4 inline-block ml-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;
