'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { role, loading, user } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('OAuth callback session error:', error.message);
          setErrorMsg(error.message);
          setTimeout(() => router.replace('/login'), 2000);
          return;
        }

        if (!session) {
          // Attempt exchange code if hash/query code exists in URL
          const hash = window.location.hash;
          if (!hash && !window.location.search.includes('code=')) {
            router.replace('/login');
          }
        }
      } catch (err: any) {
        console.error('Unexpected callback error:', err);
        setErrorMsg(err?.message || 'Authentication error.');
        setTimeout(() => router.replace('/login'), 2000);
      }
    };

    handleAuthCallback();
  }, [router]);

  useEffect(() => {
    if (!loading && user) {
      if (role === 'seller') {
        router.replace('/dashboard/overview');
      } else {
        router.replace('/account');
      }
    }
  }, [loading, user, role, router]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 text-center font-sans">
      {errorMsg ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium max-w-sm">
          <p>{errorMsg}</p>
          <p className="text-xs text-stone-500 mt-2">Redirecting to login page...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-stone-900" />
          <h2 className="text-base font-bold text-stone-900">Completing Sign In...</h2>
          <p className="text-xs text-stone-500">Please wait while we establish your session.</p>
        </div>
      )}
    </div>
  );
}
