import { Suspense } from 'react';
import OrderDetailsClient from './components/OrderDetailsClient';
import { PageLoader } from '@/components/ui/Loader';

export default function OrderDetailsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <OrderDetailsClient />
    </Suspense>
  );
}
