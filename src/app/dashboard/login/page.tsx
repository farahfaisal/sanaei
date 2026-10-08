import { Suspense } from 'react';
import type { Metadata } from 'next';
import AdminLoginClient from './components/AdminLoginClient';

export const metadata: Metadata = {
  title: 'دخول الإدارة — حِرَفي',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <AdminLoginClient />
    </Suspense>
  );
}
