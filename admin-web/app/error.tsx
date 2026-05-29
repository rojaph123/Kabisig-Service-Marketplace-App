"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled admin web error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-kabisig-bg px-5 py-10 text-kabisig-text">
          <section className="w-full max-w-lg rounded-[32px] border border-kabisig-border bg-white p-6 text-center shadow-soft dark:bg-slate-950">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl font-black text-rose-600">
              !
            </div>
            <h1 className="mt-5 text-2xl font-black">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6 text-kabisig-muted">
              The admin panel caught an unexpected problem. Try again, or refresh the page if this keeps happening.
            </p>
            {error.digest ? <p className="mt-2 text-xs text-kabisig-muted">Error ID: {error.digest}</p> : null}
            <button
              className="mt-6 rounded-2xl bg-kabisig-blue px-5 py-3 text-sm font-bold text-white"
              onClick={reset}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
