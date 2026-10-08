'use client';

import { useEffect } from 'react';

// Shown when a screen crashes, instead of the blank "Application error" page.
export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Screen error:', error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8 text-center gap-5"
      style={{ background: 'var(--background, #fff)' }}
      dir="rtl"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="حِرَفي" width={64} height={64} style={{ borderRadius: 18 }} />
      <div>
        <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--foreground, #111827)' }}>
          تعذّر عرض هذه الشاشة
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground, #6b7280)' }}>
          أعد المحاولة. إن تكرر ذلك فارجع إلى الرئيسية.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="px-6 py-3 rounded-2xl text-sm font-bold text-white active:scale-95 transition-transform"
          style={{ background: '#2a724d' }}
        >
          إعادة المحاولة
        </button>
        <a
          href="/home-screen"
          className="px-6 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-transform"
          style={{ background: 'var(--muted, #f3f4f6)', color: 'var(--foreground, #111827)' }}
        >
          الرئيسية
        </a>
      </div>
      {(error?.message || error?.digest) && (
        <p className="text-xs max-w-xs break-words" dir="ltr" style={{ color: 'var(--muted-foreground, #9ca3af)' }}>
          {error.message}{error.digest ? ` (${error.digest})` : ''}
        </p>
      )}
    </div>
  );
}
