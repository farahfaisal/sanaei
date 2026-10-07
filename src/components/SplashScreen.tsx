'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

const SEEN_KEY = 'splash_seen';

/**
 * Full-screen splash with the app logo. Shown once per browser session,
 * then fades out to reveal the page underneath.
 */
export default function SplashScreen({ duration = 1800 }: { duration?: number }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // storage unavailable — just show the splash
    }
    if (seen) {
      setVisible(false);
      return;
    }
    const fadeTimer = setTimeout(() => setFading(true), duration);
    const hideTimer = setTimeout(() => setVisible(false), duration + 500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [duration]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      <Image
        src="/assets/images/app_logo.png"
        alt="شعار حِرَفي"
        width={220}
        height={250}
        priority
        className="w-56 h-auto animate-pulse"
      />
    </div>
  );
}
