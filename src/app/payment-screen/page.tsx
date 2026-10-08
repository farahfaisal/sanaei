import { Suspense } from 'react';
import PaymentClient from './components/PaymentClient';
import { PageLoader } from '@/components/ui/Loader';

export default function PaymentPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PaymentClient />
    </Suspense>
  );
}