'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router?.replace('/onboarding-role-selection');
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'linear-gradient(160deg, #0F1A14 0%, #162219 50%, #0F1A14 100%)' }}>
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-3xl opacity-30" style={{ background: '#C9A84C', transform: 'scale(1.5)' }} />
          <Image
            src="/assets/images/__________________24_-1790287739442.png"
            alt="شعار صنايعي"
            width={200}
            height={200}
            className="object-contain relative z-10"
            priority
          />
        </div>
        <div className="mt-8 flex gap-1.5">
          {[0, 1, 2]?.map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: '#C9A84C', animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
