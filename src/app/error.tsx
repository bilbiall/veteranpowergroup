"use client";

import { useEffect } from "react";
import Link from "next/link";
import { logger } from "@/lib/logger";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error("Unhandled application render error", { error, digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f0] px-6 text-[#202a27]">
      <section className="max-w-md text-center">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="font-[var(--font-space-grotesk)] text-5xl font-medium tracking-[-.06em]">We hit a rough edge.</h1>
        <p className="mt-5 text-sm leading-6 text-[#68716c]">The problem has been logged. Try again or return to the public site.</p>
        <div className="mt-8 flex justify-center gap-5 text-xs">
          <button className="bg-[#202a27] px-5 py-3 text-[#d7f36a]" onClick={() => reset()}>Try again</button>
          <Link className="border-b border-[#202a27] py-3" href="/">Public website</Link>
        </div>
      </section>
    </main>
  );
}
