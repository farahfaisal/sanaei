import { Suspense } from 'react';
import ConversationsClient from './components/ConversationsClient';
import { PageLoader } from '@/components/ui/Loader';

export default function ConversationsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ConversationsClient />
    </Suspense>
  );
}
