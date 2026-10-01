import { Metadata } from 'next';
import IncomingRequestsClient from './components/IncomingRequestsClient';

export const metadata: Metadata = {
  title: 'الطلبات الواردة | صنايعي',
  description: 'عرض الطلبات الواردة من العملاء',
};

export default function IncomingRequestsPage() {
  return <IncomingRequestsClient />;
}
