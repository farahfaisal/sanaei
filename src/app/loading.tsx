import { PageLoader } from '@/components/ui/Loader';

// Shown instantly while the next screen loads, so a tap never feels ignored.
export default function Loading() {
  return <PageLoader />;
}
