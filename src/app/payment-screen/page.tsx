import { Suspense } from 'react';
import LogoLoader from '@/components/LogoLoader';
import PaymentClient from './components/PaymentClient';

export default function PaymentPage() {
  return (
    <Suspense fallback={<LogoLoader fullScreen />}>
      <PaymentClient />
    </Suspense>
  );
}