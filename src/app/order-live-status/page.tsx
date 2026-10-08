import { Suspense } from 'react';
import OrderLiveStatusClient from './components/OrderLiveStatusClient';
import { PageLoader } from '@/components/ui/Loader';

export default function OrderLiveStatusPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <OrderLiveStatusClient />
    </Suspense>
  );
}
