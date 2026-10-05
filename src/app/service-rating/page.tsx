'use client';

import { Suspense } from 'react';
import ServiceRatingClient from './components/ServiceRatingClient';

export default function ServiceRatingPage() {
  return (
    <Suspense fallback={
      <div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: '#2a724d', borderTopColor: 'transparent' }} />
      </div>
    }>
      <ServiceRatingClient />
    </Suspense>
  );
}
