import { Suspense } from 'react';
import OrderLiveStatusClient from './components/OrderLiveStatusClient';

export default function OrderLiveStatusPage() {
  return (
    <Suspense fallback={<div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }}><div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a5857', borderTopColor: 'transparent' }} /></div>}>
      <OrderLiveStatusClient />
    </Suspense>
  );
}
