import { Suspense } from 'react';
import ConversationsClient from './components/ConversationsClient';

export default function ConversationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center" style={{ height: '100dvh', background: '#f0f2f5' }} dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#075E54', borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    }>
      <ConversationsClient />
    </Suspense>
  );
}
