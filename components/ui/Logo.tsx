'use client';

/**
 * Brand logo for מכרזי מיכאלי מוטורס
 * Renders inline SVG for crisp display at any size.
 * Uses unique gradient IDs to avoid conflicts when multiple instances render.
 */

import { useId } from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
}

/** Icon-only gavel mark */
export function LogoIcon({ size = 32, className }: LogoIconProps) {
  const gradId = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-label="מכרזי מיכאלי מוטורס"
      role="img"
    >
      <rect x="82" y="42" width="108" height="138" rx="4" fill={`url(#${gradId})`} />
      <rect x="18" y="14" width="124" height="124" rx="4" fill="#111111" />
      <g transform="translate(96 82) rotate(-45)">
        <rect x="-34" y="-15" width="68" height="30" rx="3" fill="white" />
        <rect x="8" y="15" width="13" height="76" rx="3" fill="white" />
      </g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D4A853" />
          <stop offset="100%" stopColor="#E8C97A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface LogoFullProps {
  height?: number;
  className?: string;
  /** Show the TM mark */
  tm?: boolean;
}

/** Full horizontal logo: gavel icon + Hebrew text */
export function LogoFull({ height = 40, className, tm = false }: LogoFullProps) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`} dir="rtl">
      {/* Hebrew text */}
      <div className="flex flex-col leading-none" style={{ fontSize: height * 0.3 }}>
        <span className="font-black text-white tracking-tight" style={{ lineHeight: 1.1 }}>מכרזי</span>
        <span className="font-black text-white tracking-tight" style={{ lineHeight: 1.1 }}>מיכאלי</span>
        <span className="font-black brand-gradient-text tracking-tight" style={{ lineHeight: 1.1 }}>מוטורס</span>
      </div>
      {/* Gavel icon */}
      <div className="relative flex-shrink-0">
        <LogoIcon size={height * 0.95} />
        {tm && (
          <span
            className="absolute text-accent-light font-bold"
            style={{ top: 0, left: 0, fontSize: height * 0.16 }}
            aria-hidden="true"
          >
            TM
          </span>
        )}
      </div>
    </div>
  );
}

/** Compact logo for tight spaces (icon + single line text) */
export function LogoCompact({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <LogoIcon size={height} />
      <span className="font-black text-white" style={{ fontSize: height * 0.4 }}>
        מיכאלי <span className="brand-gradient-text">מוטורס</span>
      </span>
    </div>
  );
}
