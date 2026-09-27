import { Suspense } from 'react';
import OrderDetailsClient from './components/OrderDetailsClient';

export default function OrderDetailsPage() {
  return (
    <Suspense fallback={<div className="screen-container flex items-center justify-center"><div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin border-green-700" /></div>}>
      <OrderDetailsClient />
    </Suspense>
  );
}
