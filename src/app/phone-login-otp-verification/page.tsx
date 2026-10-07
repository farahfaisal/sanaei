import { Suspense } from 'react';
import LogoLoader from '@/components/LogoLoader';
import PhoneLoginClient from './components/PhoneLoginClient';

export default function PhoneLoginPage() {
  return (
    <Suspense fallback={<LogoLoader fullScreen />}>
      <PhoneLoginClient />
    </Suspense>
  );
}
