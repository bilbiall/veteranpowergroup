import Link from "next/link";
import { CompanyBrand } from "@/components/company-brand";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicSiteHeader() {
  return <header className="site-header">
    <Link className="brand site-brand" href="/" aria-label="Veteran Power Solutions Limited home"><CompanyBrand /></Link>
    <nav className="main-nav" aria-label="Main navigation"><Link href="/#about">About</Link><Link href="/solutions/power">Power</Link><Link href="/solutions/solar">Solar</Link><Link href="/solutions/borehole">Borehole</Link><Link href="/portfolio">Portfolio</Link><Link href="/#contact">Contact</Link></nav>
    <a className="social-header-link" href="https://web.facebook.com/veteranmailu" target="_blank" rel="noreferrer" aria-label="Veteran Power Solutions on Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 21v-8.2h2.8l.4-3.2h-3.2v-2c0-.9.3-1.6 1.6-1.6H17V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.5v3.2h2.8V21h3.4Z" /></svg><span>Facebook</span></a>
    <ThemeToggle />
  </header>;
}
