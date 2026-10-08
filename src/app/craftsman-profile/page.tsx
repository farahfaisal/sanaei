import { Suspense } from 'react';
import CraftsmanProfileClient from './components/CraftsmanProfileClient';
import { PageLoader } from '@/components/ui/Loader';

export default function CraftsmanProfilePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CraftsmanProfileClient />
    </Suspense>
  );
}