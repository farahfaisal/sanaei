import { Suspense } from 'react';
import RequestSummaryClient from './components/RequestSummaryClient';
import { PageLoader } from '@/components/ui/Loader';

export default function RequestSummaryPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequestSummaryClient />
    </Suspense>
  );
}
