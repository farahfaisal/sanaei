'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [pageKey, setPageKey] = useState(pathname);
  const prevPathname = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      setIsLoading(true);

      if (timerRef.current) clearTimeout(timerRef.current);

      // Reduced from 600ms to 200ms for snappier navigation
      timerRef.current = setTimeout(() => {
        setDisplayChildren(children);
        setPageKey(pathname);
        setIsLoading(false);
      }, 200);
    } else {
      setDisplayChildren(children);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, children]);

  return (
    <>
      <div
        key={pageKey}
        className="page-slide-in"
        style={{ minHeight: '100%' }}
      >
        {displayChildren}
      </div>

      {isLoading && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center z-[9999]"
          style={{
            background: 'linear-gradient(160deg, #0a2e18 0%, #145230 50%, #1a5c3a 100%)',
          }}
        >
          <div className="relative flex items-center justify-center mb-8">
            <span className="loader-ring loader-ring-1" />
            <span className="loader-ring loader-ring-2" />
            <span className="loader-ring loader-ring-3" />
            <div
              className="relative z-10 rounded-full overflow-hidden flex items-center justify-center loader-logo-pulse"
              style={{
                width: 80,
                height: 80,
                background: 'rgba(255,255,255,0.12)',
                border: '2px solid rgba(255,255,255,0.25)',
              }}
            >
              <img
                src="/icons/icon-192.png"
                alt="حِرَفي"
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '50%' }}
              />
            </div>
          </div>

          <p
            className="loader-fade-in"
            style={{
              color: 'rgba(255,255,255,0.9)',
              fontFamily: "'Cairo', sans-serif",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            حِرَفي
          </p>

          <div className="flex gap-2 mt-4">
            <span className="loader-dot" style={{ animationDelay: '0ms' }} />
            <span className="loader-dot" style={{ animationDelay: '180ms' }} />
            <span className="loader-dot" style={{ animationDelay: '360ms' }} />
          </div>
        </div>
      )}
    </>
  );
}
