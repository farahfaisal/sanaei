import { Suspense } from 'react';
import CustomerProfileClient from './components/CustomerProfileClient';

export default function CustomerProfilePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gray-900"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <CustomerProfileClient />
    </Suspense>
  );
}
