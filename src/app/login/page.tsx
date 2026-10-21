import type { Metadata } from "next";
import { CompanyBrand } from "@/components/company-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { publicSiteUrl } from "@/lib/surface-urls";
import { login } from "./actions";

export const metadata: Metadata = { title: "Staff login", robots: { index: false, follow: false } };

export default async function Login({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  return (
    <main className="staff-login-page min-h-screen px-6 py-10 sm:px-12">
      <div className="staff-login-inner mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between">
        <header className="staff-login-header"><a className="brand login-brand" href={publicSiteUrl} aria-label="Veteran Power Solutions Limited"><CompanyBrand /></a><ThemeToggle /></header>
        <section className="grid items-center gap-16 py-16 md:grid-cols-[1fr_390px]">
          <div className="max-w-xl">
            <p className="eyebrow">Staff access</p>
            <h1 className="font-[var(--font-space-grotesk)] text-6xl font-medium leading-[.95] tracking-[-.065em] sm:text-8xl">Welcome back.<br /><em className="staff-login-highlight not-italic">Let&apos;s get to work.</em></h1>
            <p className="staff-login-copy mt-8 max-w-md text-base leading-7">The internal workspace for your customers, documents, finances, and team.</p>
          </div>
          <form className="staff-login-form p-7 sm:p-9" action={login}>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.13em] text-[#ff855d]">Internal dashboard</p>
            <h2 className="font-[var(--font-space-grotesk)] text-3xl font-medium tracking-[-.05em]">Sign in to continue</h2>
            <p className="staff-login-hint mt-3 border-l-2 border-[#d7f36a] pl-3 text-xs leading-5">Use the staff credentials provided by your administrator.</p>
            {params.error === "invalid" && <p className="mt-5 text-sm text-[#b54328]" role="alert">Those credentials were not recognized.</p>}
            <label className="mt-8 block text-xs font-semibold" htmlFor="email">Work email</label>
            <input className="mt-2 w-full border-b border-[#b9c2ba] bg-transparent px-0 py-3 text-sm outline-none focus:border-[#ff855d]" id="email" name="email" type="email" placeholder="you@company.com" autoComplete="username" required />
            <label className="mt-6 block text-xs font-semibold" htmlFor="password">Password</label>
            <input className="mt-2 w-full border-b border-[#b9c2ba] bg-transparent px-0 py-3 text-sm outline-none focus:border-[#ff855d]" id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
            <button className="staff-login-submit mt-9 flex w-full items-center justify-between px-5 py-4 text-left text-xs font-semibold transition-transform hover:-translate-y-1" type="submit">Enter workspace <span aria-hidden="true">→</span></button>
            <a className="staff-login-return mt-5 block text-center text-xs underline underline-offset-4" href={publicSiteUrl}>Return to public website</a>
          </form>
        </section>
        <p className="staff-login-footer text-xs">Authorized staff only · Veteran Power Solutions Limited</p>
      </div>
    </main>
  );
}
