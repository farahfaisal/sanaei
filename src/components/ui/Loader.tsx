import React from 'react';

const BRAND = '#2a724d';

interface SpinnerProps {
  /** Diameter in px. */
  size?: number;
  color?: string;
  /** Show the حِرَفي mark inside the ring (used for page-level loading). */
  logo?: boolean;
  className?: string;
}

/**
 * The app's loading indicator: one brand-green arc with rounded ends that
 * draws and turns around the حِرَفي mark. Replaces the thick border spinners.
 */
export function Spinner({ size = 32, color = BRAND, logo, className = '' }: SpinnerProps) {
  const stroke = size >= 48 ? 3 : size >= 32 ? 2.75 : 2.5;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const showLogo = logo ?? size >= 48;
  const mark = Math.round(size * 0.66);

  return (
    <span
      role="status"
      aria-label="جارٍ التحميل"
      className={`herafi-spinner relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeOpacity={0.12} strokeWidth={stroke} />
        <circle
          className="herafi-spinner-arc"
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
        />
      </svg>
      {showLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/icons/icon-192.png"
          alt=""
          width={mark}
          height={mark}
          className="herafi-spinner-mark"
          style={{ width: mark, height: mark, borderRadius: '28%', objectFit: 'cover' }}
        />
      )}
    </span>
  );
}

/** Full-screen loading state for a page that is still fetching its data. */
export function PageLoader({ label, dark = false }: { label?: string; dark?: boolean }) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center gap-4"
      style={{ background: dark ? '#030712' : 'var(--background, #fff)' }}
      dir="rtl"
    >
      <Spinner size={64} logo color={dark ? '#10b981' : BRAND} />
      {label && (
        <p className="text-sm" style={{ color: dark ? '#9ca3af' : 'var(--muted-foreground, #6b7280)' }}>
          {label}
        </p>
      )}
    </div>
  );
}

export default Spinner;
