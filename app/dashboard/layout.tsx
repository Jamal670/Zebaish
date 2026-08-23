'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/hooks/useAuth';
import { ResellerProvider } from '@/components/reseller/context/ResellerContext';
import { ResellerSidebar } from '@/components/reseller/components/ResellerSidebar';
import { ResellerHeader } from '@/components/reseller/components/ResellerHeader';
import { Loader2 } from 'lucide-react';

function DashboardShellContent({ children }: { children: React.ReactNode }) {
  const { user, role, resellerProfile, sellerStatus, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/reseller/login');
    } else if (role === 'customer') {
      // Authenticated Customer attempting to access Seller Dashboard -> Redirect to /account
      router.replace('/account');
    }
  }, [user, role, loading, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/reseller/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-900">
        <Loader2 className="w-8 h-8 animate-spin text-stone-700 mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Authenticating Seller Session...
        </p>
      </div>
    );
  }

  if (!user || role !== 'seller' || !resellerProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-900">
        <Loader2 className="w-8 h-8 animate-spin text-stone-700 mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Redirecting to Authorized Portal...
        </p>
      </div>
    );
  }



  return (
    <div className="bg-stone-100 min-h-screen text-stone-900 flex flex-col lg:flex-row">
      <ResellerSidebar
        onLogout={handleLogout}
        onNavigateHome={() => router.push('/')}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <ResellerHeader />
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ResellerProvider>
      <DashboardShellContent>{children}</DashboardShellContent>
    </ResellerProvider>
  );
}
