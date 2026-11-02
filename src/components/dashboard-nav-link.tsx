"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardNavLink({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  const pathname = usePathname();
  const isCurrent = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return <Link className={compact ? undefined : "dashboard-nav-link"} href={href} aria-current={isCurrent ? "page" : undefined}>
    {!compact && <span className="nav-icon" aria-hidden="true" />}
    <span>{label}</span>
    <span className="nav-selected-check" aria-hidden="true">{isCurrent ? "✓" : ""}</span>
  </Link>;
}
