'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ResellerUpdatePass } from '@/components/reseller/ResellerUpdatePass';

export default function ResellerUpdatePasswordRoutePage() {
  const router = useRouter();

  return (
    <ResellerUpdatePass
      onSuccess={() => router.push('/reseller/login')}
      onNavigateLogin={() => router.push('/reseller/login')}
      onNavigateHome={() => router.push('/')}
    />
  );
}
