'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/hooks/useAuth';
import { UserLogin } from '@/components/users/UserLogin';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, role, resellerProfile, sellerStatus, loading } = useAuth();
  const router = useRouter();

  const handlePostLoginRedirect = useCallback(() => {
    if (!role) return;
    if (role === 'seller') {
      if (sellerStatus === 'Suspended' || resellerProfile?.status === 'Suspended') {
        return;
      }
      router.replace('/dashboard');
    } else {
      router.replace('/account');
    }
  }, [role, sellerStatus, resellerProfile, router]);

  useEffect(() => {
    if (!loading && user && role) {
      handlePostLoginRedirect();
    }
  }, [user, loading, role, handlePostLoginRedirect]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-900">
        <Loader2 className="w-8 h-8 animate-spin text-stone-700 mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Checking Session...
        </p>
      </div>
    );
  }

  if (user && (role === 'seller' || role === 'customer')) {
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
    <UserLogin
      onLoginSuccess={handlePostLoginRedirect}
      onNavigateUserSignup={() => router.push('/signup')}
      onNavigateResellerSignup={() => router.push('/reseller/signup')}
      onNavigateHome={() => router.push('/')}
      onNavigateForgotPass={() => router.push('/reseller/forgot-password')}
    />
  );
}
