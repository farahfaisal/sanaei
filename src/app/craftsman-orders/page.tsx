import { Suspense } from 'react';
import CraftsmanOrdersClient from './components/CraftsmanOrdersClient';

export default function CraftsmanOrdersPage() {
  return (
    <Suspense fallback={<div className="screen-container flex items-center justify-center" style={{ background: 'var(--background)' }} />}>
      <CraftsmanOrdersClient />
    </Suspense>
  );
}
