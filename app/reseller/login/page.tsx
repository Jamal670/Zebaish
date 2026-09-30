'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResellerLoginRouteRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isRecovery = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
      if (isRecovery) {
        router.replace('/reseller/update-password');
        return;
      }
    }
    router.replace('/login');
  }, [router]);

  return null;
}
