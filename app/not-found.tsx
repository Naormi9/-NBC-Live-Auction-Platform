import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <div className="text-6xl">🔍</div>
      <h2 className="text-xl font-bold">הדף לא נמצא</h2>
      <p className="text-text-secondary">העמוד שחיפשת לא קיים.</p>
      <Link href="/" className="btn-accent px-6 py-3 rounded-xl">
        חזרה לדף הבית
      </Link>
    </div>
  );
}
