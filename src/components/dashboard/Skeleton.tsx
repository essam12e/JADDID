/**
 * The shapes a page takes before its data arrives.
 *
 * Next's App Router streams a `loading.tsx` the instant a navigation
 * starts — without one, the browser sits on the *old* page until every
 * query on the new one has finished, which is what makes a server-
 * rendered dashboard feel heavy even when it is fast. These also give
 * the router something to prefetch: with a loading boundary present it
 * prefetches dynamic routes on hover, so the data is often already in
 * flight before the click.
 */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/70 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
      <div className="flex items-center gap-3">
        <SkeletonLine className="h-12 w-12 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine className="h-3.5 w-2/3" />
          <SkeletonLine className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <SkeletonLine className="h-6 w-24 rounded-lg" />
        <SkeletonLine className="h-6 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonPage({ cards = 6 }: { cards?: number }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">جاري التحميل…</span>
      <div className="mb-6 space-y-2">
        <SkeletonLine className="h-5 w-48" />
        <SkeletonLine className="h-3 w-24" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}
