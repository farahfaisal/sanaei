'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // Route at once: no splash screen, no fixed wait.
    {
      if (user && profile) {
        if (profile?.role === 'craftsman') {
          router?.replace('/craftsman-orders');
        } else if (profile?.role === 'admin') {
          router?.replace('/dashboard');
        } else {
          router?.replace('/home-screen');
        }
      } else if (user && !profile) {
        router?.replace('/home-screen');
      } else {
        router?.replace('/onboarding-role-selection');
      }
    }
  }, [router, user, profile, loading]);

  // Blank for the instant before routing; no logo screen is shown.
  return <div className="min-h-screen bg-white" />;
}
