import { Suspense } from 'react';
import CustomerProfileClient from './components/CustomerProfileClient';
import { PageLoader } from '@/components/ui/Loader';

export default function CustomerProfilePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CustomerProfileClient />
    </Suspense>
  );
}
