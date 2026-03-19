export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`skeleton h-4 ${className}`} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border p-5 space-y-3" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-4 w-20" />
      </div>
      <div className="skeleton h-6 w-3/4" />
      <div className="skeleton h-4 w-1/2" />
      <div className="flex justify-between">
        <div className="skeleton h-4 w-16" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="טוען תוכן...">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
      <span className="sr-only">טוען תוכן...</span>
    </div>
  );
}
