import { Suspense } from 'react';
import ChatClient from './components/ChatClient';

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="screen-container bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    }>
      <ChatClient />
    </Suspense>
  );
}
