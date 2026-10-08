import { Suspense } from 'react';
import ChatClient from './components/ChatClient';
import { PageLoader } from '@/components/ui/Loader';

export default function ChatPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ChatClient />
    </Suspense>
  );
}
