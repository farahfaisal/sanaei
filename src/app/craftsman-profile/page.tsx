import { Suspense } from 'react';
import LogoLoader from '@/components/LogoLoader';
import CraftsmanProfileClient from './components/CraftsmanProfileClient';

export default function CraftsmanProfilePage() {
  return (
    <Suspense fallback={<LogoLoader fullScreen />}>
      <CraftsmanProfileClient />
    </Suspense>
  );
}