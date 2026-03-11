'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <div className="text-6xl">⚠️</div>
      <h2 className="text-xl font-bold">משהו השתבש</h2>
      <p className="text-text-secondary text-center max-w-md">
        אירעה שגיאה בטעינת העמוד. נסה שוב או חזור לדף הבית.
      </p>
      <button onClick={reset} className="btn-accent px-6 py-3 rounded-xl">
        נסה שוב
      </button>
    </div>
  );
}
