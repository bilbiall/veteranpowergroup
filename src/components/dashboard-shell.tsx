import Link from "next/link";
import { logout } from "@/app/login/actions";

const navGroups: [string, [string, string][]][] = [
  ["Workspace", [["Dashboard", "/dashboard"], ["Customers", "/dashboard/customers"]]],
  ["Finance", [["Quotations", "/dashboard/quotations"], ["Invoices", "/dashboard/invoices"], ["Receipts", "/dashboard/receipts"]]],
  ["Manage", [["Settings", "/dashboard/settings"]]],
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" href="/"><span className="brand-mark">N</span><span>northstar</span></Link>
        <div className="workspace-switcher"><span className="workspace-dot" /> Northstar demo workspace</div>
        <nav className="dashboard-nav" aria-label="Staff navigation">
          {navGroups.map(([group, items]) => <div className="nav-group" key={group}>
            <span className="nav-group-title">{group}</span>
            {items.map(([label, href]) => <Link className="dashboard-nav-link" href={href} key={href}><span className="nav-icon" />{label}</Link>)}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/">← View public site</Link>
          <form action={logout}><button className="sidebar-logout" type="submit">Sign out</button></form>
          <div className="user-chip"><span className="avatar">NS</span><span><b>Prototype admin</b><small>Local demo access</small></span></div>
        </div>
      </aside>
      <nav className="mobile-dashboard-nav" aria-label="Staff navigation">
        {navGroups.flatMap(([, items]) => items).map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        <form action={logout}><button type="submit">Sign out</button></form>
      </nav>
      <div className="dashboard-content">{children}</div>
    </div>
  );
}
