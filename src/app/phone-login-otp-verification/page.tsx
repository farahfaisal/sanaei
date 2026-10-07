import { Suspense } from 'react';
import PhoneLoginClient from './components/PhoneLoginClient';

export default function PhoneLoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin" /></div>}>
      <PhoneLoginClient />
    </Suspense>
  );
}
