'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ResellerFgtPass } from '@/components/reseller/resellerFgtPass';
import { useAuth } from '@/src/hooks/useAuth';

export default function ResellerForgotPasswordRoutePage() {
  const router = useRouter();
  const { user, resellerProfile, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && resellerProfile) {
      router.push('/dashboard');
    }
  }, [user, resellerProfile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <ResellerFgtPass
      onNavigateLogin={() => router.push('/reseller/login')}
      onNavigateHome={() => router.push('/')}
    />
  );
}
