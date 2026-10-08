'use client';

import React, { Suspense } from 'react';
import DashboardClient from './components/DashboardClient';
import AdminGuard from './components/AdminGuard';
import { PageLoader } from '@/components/ui/Loader';

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoader dark />}>
      <AdminGuard>
        <DashboardClient />
      </AdminGuard>
    </Suspense>
  );
}
