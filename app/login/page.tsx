'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/hooks/useAuth';
import { UserLogin } from '@/components/users/UserLogin';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && userProfile) {
      router.replace('/account');
    }
  }, [user, userProfile, loading, router]);

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

  if (user && userProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-900">
        <Loader2 className="w-8 h-8 animate-spin text-stone-700 mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Redirecting to Account...
        </p>
      </div>
    );
  }

  return (
    <UserLogin
      onLoginSuccess={() => router.replace('/account')}
      onNavigateSignup={() => router.push('/signup')}
      onNavigateHome={() => router.push('/')}
    />
  );
}


