"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#fff9f2] text-[#111]">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="font-serif text-3xl">This page couldn&apos;t load</h1>
          <p className="mt-2 text-sm text-black/60">Reload to try again.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 rounded-full bg-[#111] px-4 py-2 text-sm font-semibold text-white"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
