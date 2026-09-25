import Link from "next/link";
import { login } from "./actions";
import { env } from "@/lib/env";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-[#202a27] px-6 py-10 text-[#f6f5f0] sm:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between">
        <Link className="brand text-[#f6f5f0]" href="/"><span className="brand-mark">N</span><span>northstar</span></Link>
        <section className="grid items-center gap-16 py-16 md:grid-cols-[1fr_390px]">
          <div className="max-w-xl">
            <p className="eyebrow">Staff access</p>
            <h1 className="font-[var(--font-space-grotesk)] text-6xl font-medium leading-[.95] tracking-[-.065em] sm:text-8xl">Welcome back.<br /><em className="text-[#d7f36a] not-italic">Let&apos;s get to work.</em></h1>
            <p className="mt-8 max-w-md text-base leading-7 text-[#aabbb2]">The internal workspace for your customers, documents, finances, and team.</p>
          </div>
          <form className="bg-[#f6f5f0] p-7 text-[#202a27] sm:p-9" action={login}>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.13em] text-[#ff855d]">Internal dashboard</p>
            <h2 className="font-[var(--font-space-grotesk)] text-3xl font-medium tracking-[-.05em]">Sign in to continue</h2>
            <p className="mt-3 border-l-2 border-[#d7f36a] pl-3 text-xs leading-5 text-[#68716c]">Local prototype account: {env.PROTOTYPE_ADMIN_EMAIL}<br />Credentials are configured in your ignored .env file.</p>
            {params.error === "invalid" && <p className="mt-5 text-sm text-[#b54328]" role="alert">Those credentials were not recognized.</p>}
            <label className="mt-8 block text-xs font-semibold" htmlFor="email">Work email</label>
            <input className="mt-2 w-full border-b border-[#b9c2ba] bg-transparent px-0 py-3 text-sm outline-none focus:border-[#ff855d]" id="email" name="email" type="email" defaultValue={env.PROTOTYPE_ADMIN_EMAIL} placeholder="you@company.com" required />
            <label className="mt-6 block text-xs font-semibold" htmlFor="password">Password</label>
            <input className="mt-2 w-full border-b border-[#b9c2ba] bg-transparent px-0 py-3 text-sm outline-none focus:border-[#ff855d]" id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
            <button className="mt-9 flex w-full items-center justify-between bg-[#202a27] px-5 py-4 text-left text-xs font-semibold text-[#d7f36a] transition-transform hover:-translate-y-1" type="submit">Enter workspace <span aria-hidden="true">→</span></button>
            <Link className="mt-5 block text-center text-xs text-[#68716c] underline underline-offset-4" href="/">Return to public website</Link>
          </form>
        </section>
        <p className="text-xs text-[#7e9188]">Authorized staff only · Northstar Systems</p>
      </div>
    </main>
  );
}
