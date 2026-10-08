'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ADMIN_LOGIN_PATH, isAdminRole } from '@/lib/auth/admin';

/**
 * Second line of defence behind the middleware: renders the dashboard only for
 * a signed-in admin, otherwise sends the visitor to the admin login page.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();

  // Signed in but this user's profile hasn't arrived yet → still checking.
  const checking = loading || (!!user && profile?.id !== user.id);
  const allowed = !checking && !!user && isAdminRole(profile?.role);

  useEffect(() => {
    if (checking || allowed) return;
    const reason = user ? '&reason=not_admin' : '';
    router.replace(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname || '/dashboard')}${reason}`);
  }, [checking, allowed, user, router, pathname]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center" role="status" aria-label="جاري التحقق">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
