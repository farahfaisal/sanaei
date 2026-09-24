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
