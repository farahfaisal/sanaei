'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      if (user && profile) {
        // Redirect based on role
        if (profile?.role === 'craftsman') {
          router?.replace('/craftsman-orders');
        } else if (profile?.role === 'admin') {
          router?.replace('/dashboard');
        } else {
          router?.replace('/home-screen');
        }
      } else if (user && !profile) {
        // User exists but no profile yet — go home as fallback
        router?.replace('/home-screen');
      } else {
        // Not logged in — go to onboarding
        router?.replace('/onboarding-role-selection');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [router, user, profile, loading]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="flex flex-col items-center">
        <Image
          src="/assets/images/__________________24_-1790287739442.png"
          alt="شعار صنايعي"
          width={200}
          height={200}
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
