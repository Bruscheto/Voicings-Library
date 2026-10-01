'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-shell">
      <section className="empty-state" role="alert">
        <h1 className="text-2xl font-semibold tracking-tight">The library couldn’t load.</h1>
        <p className="mt-3 text-gray-600">Please try again in a moment.</p>
        <button type="button" className="primary-button mt-6" onClick={reset}>
          Try again
        </button>
      </section>
    </div>
  );
}
