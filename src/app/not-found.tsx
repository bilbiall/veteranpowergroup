import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f0] px-6 text-[#202a27]">
      <section className="max-w-md text-center">
        <p className="eyebrow">404</p>
        <h1 className="font-[var(--font-space-grotesk)] text-5xl font-medium tracking-[-.06em]">That page moved on.</h1>
        <p className="mt-5 text-sm leading-6 text-[#68716c]">The requested page could not be found.</p>
        <Link className="mt-8 inline-flex bg-[#202a27] px-5 py-3 text-xs text-[#d7f36a]" href="/">Return home</Link>
      </section>
    </main>
  );
}
