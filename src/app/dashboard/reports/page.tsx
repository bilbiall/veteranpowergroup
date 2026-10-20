import { prisma } from "@/lib/prisma";
import { requirePrototypeSession } from "@/lib/prototype-auth";

export default async function ReportsPage() {
  await requirePrototypeSession();
  const [prospects, findings, visits, documents] = await Promise.all([
    prisma.prospect.count(),
    prisma.finding.count(),
    prisma.websiteVisit.count(),
    prisma.document.groupBy({ by: ["type"], _count: { _all: true }, _sum: { total: true } }),
  ]);
  const reportRows = [
    { label: "Website page views", value: visits },
    { label: "Prospects", value: prospects },
    { label: "Findings", value: findings },
    ...documents.map((entry) => ({ label: `${entry.type.charAt(0)}${entry.type.slice(1).toLowerCase()}s`, value: entry._count._all })),
  ];
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Insights</p><h1>Reports</h1><p className="dashboard-note">Download a workbook with reports, findings, analytics, prospects, receipts, quotations, and invoices.</p></div><a className="dashboard-button download-all-button" href="/api/exports/all">↓ Download all</a></header>
    <section className="panel report-summary"><div className="panel-heading"><div><p className="eyebrow">Workbook contents</p><h3>All operational data</h3></div><span className="prototype-badge">Excel workbook</span></div><div className="report-sheet-grid">{["Reports", "Findings", "Analytics", "Prospects", "Receipts", "Quotations", "Invoices"].map((sheet, index) => <article key={sheet}><span>{String(index + 1).padStart(2, "0")}</span><b>{sheet}</b></article>)}</div></section>
    <section className="metrics-grid report-metrics" aria-label="Report record counts">{reportRows.map((row) => <article className="metric-card" key={row.label}><div className="metric-head">{row.label}</div><strong>{row.value.toLocaleString("en")}</strong><p>Current total</p></article>)}</section>
  </main>;
}
