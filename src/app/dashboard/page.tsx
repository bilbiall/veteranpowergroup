import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSectionAccess } from "@/lib/prototype-auth";

const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const amountFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export default async function Dashboard() {
  await requireSectionAccess("dashboard");
  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  since.setHours(0, 0, 0, 0);
  const [customerCount, documents, recentActivity, invoices, pageViews] = await Promise.all([
    prisma.customer.count(),
    prisma.document.groupBy({ by: ["type"], _sum: { total: true }, _count: { _all: true } }),
    prisma.auditLog.findMany({ take: 4, orderBy: { createdAt: "desc" }, select: { id: true, summary: true, createdAt: true, actor: { select: { name: true, email: true } } } }),
    prisma.document.findMany({ where: { type: "INVOICE", createdAt: { gte: since } }, select: { total: true, createdAt: true } }),
    prisma.websiteVisit.count(),
  ]);

  const summary = Object.fromEntries(documents.map((entry) => [entry.type, { total: entry._sum.total ?? 0, count: entry._count._all }])) as Record<string, { total: number; count: number }>;
  const metrics = [
    ["Customers", numberFormat.format(customerCount), "sample customer records"],
    ["Quotations", amountFormat.format(summary.QUOTATION?.total ?? 0), `${summary.QUOTATION?.count ?? 0} sample documents`],
    ["Invoices", amountFormat.format(summary.INVOICE?.total ?? 0), `${summary.INVOICE?.count ?? 0} sample documents`],
    ["Receipts", numberFormat.format(summary.RECEIPT?.count ?? 0), "sample documents"],
    ["Website visits", numberFormat.format(pageViews), "public website page views"],
  ];

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(since.getFullYear(), since.getMonth() + index, 1);
    return { label: date.toLocaleDateString("en", { month: "short" }), value: invoices.filter((invoice) => invoice.createdAt.getFullYear() === date.getFullYear() && invoice.createdAt.getMonth() === date.getMonth()).reduce((sum, invoice) => sum + invoice.total, 0) };
  });
  const maxAmount = Math.max(...months.map((month) => month.value), 1);
  const points = months.map((month, index) => `${index * 100},${125 - (month.value / maxAmount) * 100}`).join(" ");

  return <main className="dashboard-main">
    <header className="dashboard-header"><div><p className="dashboard-kicker">{new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><h1>Your workspace</h1></div><span className="prototype-badge">Prototype · sample data</span></header>
    <section className="dashboard-intro"><div><p className="eyebrow">Veteran staff portal</p><h2>A clear view of <span>what&apos;s moving.</span></h2><p className="dashboard-note">Figures use fictional local data and provisional rules.</p></div><Link className="dashboard-button" href="/dashboard/quotations">+ New quotation</Link></section>
    <section className="metrics-grid" aria-label="Workspace summary">{metrics.map(([label, value, caption]) => <article className="metric-card" key={label}><div className="metric-head"><span>{label}</span><span className="metric-more" aria-hidden="true">•••</span></div><strong>{value}</strong><p>{caption}</p></article>)}</section>
    <section className="dashboard-lower"><article className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Sample workspace</p><h3>Recent activity</h3></div><Link href="/dashboard/quotations">Quotations ↗</Link></div>
      {recentActivity.length === 0 ? <p className="empty-state">Activity will appear here as you add sample records.</p> : recentActivity.map((entry) => <div className="activity-row" key={entry.id}><span className="activity-avatar green" aria-hidden="true">N</span><div><b>{entry.summary}</b><p>{entry.actor?.name ?? entry.actor?.email ?? "Prototype admin"}</p></div><time dateTime={entry.createdAt.toISOString()}>{entry.createdAt.toLocaleDateString("en", { month: "short", day: "numeric" })}</time></div>)}
    </article><article className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Invoice totals</p><h3>Recent six months</h3></div><span className="prototype-badge">No currency set</span></div><div className="chart-value">{amountFormat.format(invoices.reduce((sum, invoice) => sum + invoice.total, 0))}</div><div className="chart"><div className="chart-grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 500 155" preserveAspectRatio="none" role="img" aria-label="Invoice totals over the last six months"><polyline points={points} fill="none" stroke="#087a45" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg></div><div className="chart-labels">{months.map((month) => <span key={month.label}>{month.label}</span>)}</div></article></section>
  </main>;
}
