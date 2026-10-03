import { Suspense } from 'react';
import RequestSummaryClient from './components/RequestSummaryClient';

export default function RequestSummaryPage() {
  return (
    <Suspense fallback={<div className="screen-container flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <RequestSummaryClient />
    </Suspense>
  );
}
