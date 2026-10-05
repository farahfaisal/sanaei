import { Metadata } from 'next';
import IncomingRequestsClient from './components/IncomingRequestsClient';

export const metadata: Metadata = {
  title: 'الطلبات الواردة | حِرَفي',
  description: 'عرض الطلبات الواردة من العملاء',
};

export default function IncomingRequestsPage() {
  return <IncomingRequestsClient />;
}
