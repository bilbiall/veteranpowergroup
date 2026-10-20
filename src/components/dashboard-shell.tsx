import Link from "next/link";
import { logout } from "@/app/login/actions";
import { CompanyBrand } from "@/components/company-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { publicSiteUrl } from "@/lib/surface-urls";

const navGroups: [string, [string, string][]][] = [
  ["Workspace", [["Dashboard", "/dashboard"], ["Customers", "/dashboard/customers"], ["Customer enquiries", "/dashboard/prospects"]]],
  ["Finance", [["Quotations", "/dashboard/quotations"], ["Invoices", "/dashboard/invoices"], ["Receipts", "/dashboard/receipts"], ["School payment templates", "/dashboard/payment-plans"]]],
  ["Insights", [["Website analytics", "/dashboard/analytics"], ["Reports", "/dashboard/reports"], ["Findings", "/dashboard/findings"], ["Portfolio", "/dashboard/portfolio"]]],
  ["Manage", [["Settings", "/dashboard/settings"]]],
];

export function DashboardShell({ children, staff }: { children: React.ReactNode; staff: { name: string; email: string } }) {
  const initials = staff.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" href="/dashboard" aria-label="Veteran staff portal"><CompanyBrand /></Link>
        <div className="workspace-switcher"><span className="workspace-dot" /> Veteran staff workspace</div>
        <nav className="dashboard-nav" aria-label="Staff navigation">
          {navGroups.map(([group, items]) => <div className="nav-group" key={group}>
            <span className="nav-group-title">{group}</span>
            {items.map(([label, href]) => <Link className="dashboard-nav-link" href={href} key={href}><span className="nav-icon" />{label}</Link>)}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          <ThemeToggle />
          <a className="sidebar-download-all" href="/api/exports/all">↓ Download all data</a>
          <a href={publicSiteUrl}>← View public site</a>
          <form action={logout}><button className="sidebar-logout" type="submit">Sign out</button></form>
          <div className="user-chip"><span className="avatar">{initials}</span><span><b>{staff.name}</b><small>{staff.email}</small></span></div>
        </div>
      </aside>
      <nav className="mobile-dashboard-nav" aria-label="Staff navigation">
        {navGroups.flatMap(([, items]) => items).map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        <a href="/api/exports/all">Download all</a>
        <ThemeToggle />
        <form action={logout}><button type="submit">Sign out</button></form>
      </nav>
      <div className="dashboard-content">{children}</div>
    </div>
  );
}
