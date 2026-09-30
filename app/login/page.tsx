'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/hooks/useAuth';
import { UserLogin } from '@/components/users/UserLogin';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, role, resellerProfile, sellerStatus, loading } = useAuth();
  const router = useRouter();

  const handlePostLoginRedirect = () => {
    if (role === 'seller') {
      if (sellerStatus === 'Suspended' || resellerProfile?.status === 'Suspended') {
        return;
      }
      router.replace('/dashboard');
    } else {
      router.replace('/account');
    }
  };

  useEffect(() => {
    if (!loading && user) {
      handlePostLoginRedirect();
    }
  }, [user, role, sellerStatus, resellerProfile, loading]);

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
