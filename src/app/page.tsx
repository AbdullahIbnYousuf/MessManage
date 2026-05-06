'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Layout wrapper handles the actual auth redirects.
    // If we land here and layout hasn't redirected us elsewhere,
    // we default to dashboard.
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="page-loading">
      <div className="spinner"></div>
    </div>
  );
}
