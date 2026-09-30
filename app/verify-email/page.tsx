'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmailVerificationPage } from '@/components/EmailVerificationPage';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || undefined;

  return <EmailVerificationPage email={email} />;
}

export default function VerifyEmailRoutePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
