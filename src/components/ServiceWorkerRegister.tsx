'use client';

import { useEffect } from 'react';

/** Registers the service worker in production so the app can be installed. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  }, []);
  return null;
}
