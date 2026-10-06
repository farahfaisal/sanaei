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
    }, 2800);

    return () => clearTimeout(timer);
  }, [router, user, profile, loading]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <style>{`
        @keyframes splashFadeIn {
          0% { opacity: 0; transform: scale(0.6); }
          60% { opacity: 1; transform: scale(1.08); }
          80% { transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
        .splash-logo {
          animation: splashFadeIn 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                     splashPulse 2s ease-in-out 1s infinite;
        }
      `}</style>
      <div className="flex flex-col items-center">
        <div className="splash-logo">
          <Image
            src="/assets/images/a_clean_vector_style_transparent_background_logo_g__1_-1791326599819.png?v=2"
            alt="شعار حِرَفي"
            width={220}
            height={220}
            className="object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}
