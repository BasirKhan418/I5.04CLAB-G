"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-lab-red">Something broke</p>
      <h1 className="mt-2 font-heading text-3xl">This page couldn&apos;t load</h1>
      <p className="mt-2 max-w-sm text-sm text-ink/60">
        Reload and try again. If it keeps happening, go back to the dashboard.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          Reload
        </button>
        <a
          href="/dashboard"
          className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-ink/15"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
