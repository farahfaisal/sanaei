import React from 'react';
import Image from 'next/image';

interface LogoLoaderProps {
  /** Fill the whole screen (page transitions) or just its container (sections). */
  fullScreen?: boolean;
  /** Optional text under the logo, e.g. "جاري التحميل…". */
  label?: string;
  size?: number;
}

/** Branded loading indicator: the app mark with a soft pulse and a spinning ring. */
export default function LogoLoader({ fullScreen = false, label, size = 72 }: LogoLoaderProps) {
  const ring = size + 28;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen ? 'fixed inset-0 z-[90] bg-white' : 'w-full py-16'
      }`}
    >
      <div className="relative flex items-center justify-center" style={{ width: ring, height: ring }}>
        <span
          className="absolute inset-0 rounded-full border-[3px] border-green-100 border-t-primary animate-spin"
          aria-hidden="true"
        />
        <Image
          src="/assets/images/app_mark.png"
          alt=""
          width={size}
          height={size}
          priority
          className="logo-loader-pulse object-contain"
          style={{ width: size, height: 'auto' }}
        />
      </div>
      <span className={label ? 'text-sm text-gray-500' : 'sr-only'}>{label ?? 'جاري التحميل…'}</span>
    </div>
  );
}
