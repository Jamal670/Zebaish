'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/hooks/useAuth';
import { UserSignup } from '@/components/users/UserSignup';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && role) {
      if (role === 'seller') {
        router.replace('/dashboard');
      } else {
        router.replace('/account');
      }
    }
  }, [user, role, loading, router]);

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

  if (user && role) {
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
    <UserSignup
      onSignupSuccess={(email) => router.push(`/verify-email?email=${encodeURIComponent(email || '')}`)}
      onNavigateLogin={() => router.push('/login')}
      onNavigateHome={() => router.push('/')}
    />
  );
}


