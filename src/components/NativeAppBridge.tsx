'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startNativeApp } from '@/lib/nativeApp';

/** Sets up the Android / iOS app shell (does nothing in a normal browser). */
export default function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    startNativeApp((url) => router?.push(url))?.catch(() => {});
  }, [router]);

  return null;
}
