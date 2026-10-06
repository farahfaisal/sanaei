import { Suspense } from 'react';
import MyRequestsClient from './components/MyRequestsClient';

export default function MyRequestsPage() {
  return (
    <Suspense fallback={null}>
      <MyRequestsClient />
    </Suspense>
  );
}
