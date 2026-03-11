'use client';

export default function LiveBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 bg-live-dot/10 text-live-dot px-3 py-1 rounded-full text-xs font-bold ${className}`}>
      <span className="live-dot" />
      שידור חי
    </span>
  );
}
