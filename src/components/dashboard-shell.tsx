import Link from "next/link";
import { logout } from "@/app/login/actions";
import { CompanyBrand } from "@/components/company-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNavLink } from "@/components/dashboard-nav-link";
import { publicSiteUrl } from "@/lib/surface-urls";
import { firstAllowedHref, staffSectionGroups, type StaffAccessKey } from "@/lib/staff-sections";

export function DashboardShell({ children, staff, sections }: { children: React.ReactNode; staff: { name: string; email: string }; sections: StaffAccessKey[] }) {
  const initials = staff.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const navGroups = staffSectionGroups.map(({ group, sections: items }) => ({ group, items: items.filter((item) => sections.includes(item.key)) })).filter(({ items }) => items.length);
  const homeHref = firstAllowedHref(sections) ?? "/dashboard";
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" href={homeHref} aria-label="Veteran staff portal"><CompanyBrand /></Link>
        <div className="workspace-switcher"><span className="workspace-dot" /> Veteran staff workspace</div>
        <nav className="dashboard-nav" aria-label="Staff navigation">
          {navGroups.map(({ group, items }) => <div className="nav-group" key={group}>
            <span className="nav-group-title">{group}</span>
            {items.map(({ key, label, href }) => <DashboardNavLink href={href} label={label} key={key} />)}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          <ThemeToggle />
          {sections.includes("reports") && <a className="sidebar-download-all" href="/api/exports/all">↓ Download all data</a>}
          <a href={publicSiteUrl}>← View public site</a>
          <form action={logout}><button className="sidebar-logout" type="submit">Sign out</button></form>
          <div className="user-chip"><span className="avatar">{initials}</span><span><b>{staff.name}</b><small>{staff.email}</small></span></div>
        </div>
      </aside>
      <nav className="mobile-dashboard-nav" aria-label="Staff navigation">
        {navGroups.flatMap(({ items }) => items).map(({ key, label, href }) => <DashboardNavLink href={href} label={label} compact key={key} />)}
        {sections.includes("reports") && <a href="/api/exports/all">Download all</a>}
        <ThemeToggle />
        <form action={logout}><button type="submit">Sign out</button></form>
      </nav>
      <div className="dashboard-content">{children}</div>
    </div>
  );
}
