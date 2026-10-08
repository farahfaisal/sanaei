'use client';

import { Suspense } from 'react';
import ServiceRatingClient from './components/ServiceRatingClient';
import { PageLoader } from '@/components/ui/Loader';

export default function ServiceRatingPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ServiceRatingClient />
    </Suspense>
  );
}
