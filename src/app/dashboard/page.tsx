'use client';

import React, { Suspense } from 'react';
import DashboardClient from './components/DashboardClient';
import AdminGuard from './components/AdminGuard';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <AdminGuard>
        <DashboardClient />
      </AdminGuard>
    </Suspense>
  );
}
