'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ResellerDashboard } from '@/components/reseller/ResellerDashboard';
import { useAuth } from '@/src/hooks/useAuth';

export default function ResellerDashboardRoutePage() {
  const router = useRouter();
  const { user, resellerProfile, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user || !resellerProfile) {
        router.push('/reseller/login');
      }
    }
  }, [user, resellerProfile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider">Loading Reseller Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !resellerProfile) {
    return null;
  }

  return (
    <ResellerDashboard
      onLogout={async () => {
        await logout();
        router.push('/reseller/login');
      }}
      onNavigateHome={() => router.push('/')}
    />
  );
}

