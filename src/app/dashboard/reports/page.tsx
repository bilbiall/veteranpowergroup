import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStaffAccess, requireSectionAccess } from "@/lib/prototype-auth";
import { canDownloadAllData, type StaffAccessKey } from "@/lib/staff-sections";

type DownloadTileProps = { title: string; description: string; dataset: string; count: number };

function DownloadTile({ title, description, dataset, count }: DownloadTileProps) {
  return <article className="report-download-tile">
    <div><span className="report-tile-index">{count.toLocaleString("en")} records</span><h3>{title}</h3><p>{description}</p></div>
    <form action={`/api/exports/${dataset}`} method="get" className="report-range-form">
      <label>From <input type="datetime-local" name="from" required aria-label={`Start date and time for ${title}`} /></label>
      <label>To <input type="datetime-local" name="to" required aria-label={`End date and time for ${title}`} /></label>
      <button className="dashboard-button" type="submit">Download Excel</button>
    </form>
  </article>;
}

export default async function ReportsPage() {
  const session = await requireSectionAccess("reports");
  const access = await getStaffAccess(session.userId);
  const can = (key: string) => access.sections.includes(key as StaffAccessKey);
  const [prospects, findings, visits, documentCounts, auditLogs] = await Promise.all([
    can("report-prospects") ? prisma.prospect.count() : Promise.resolve(0),
    can("report-findings") ? prisma.finding.count() : Promise.resolve(0),
    can("report-analytics") ? prisma.websiteVisit.count() : Promise.resolve(0),
    can("report-receipts") || can("report-quotations") || can("report-invoices")
      ? prisma.document.groupBy({ by: ["type"], _count: { _all: true } })
      : Promise.resolve([]),
    can("report-audit-trail") ? prisma.auditLog.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true, email: true } } } }) : Promise.resolve([]),
  ]);
  const count = (type: string) => documentCounts.find((item) => item.type === type)?._count._all ?? 0;
  const tileOptions: (DownloadTileProps | false)[] = [
    can("report-summary") && { title: "Reports", description: "Summary totals for the selected period.", dataset: "summary", count: 1 },
    can("report-findings") && { title: "Findings", description: "Recorded observations, issues and follow-up actions. Downloaded separately from the all-data workbook.", dataset: "findings", count: findings },
    can("report-analytics") && { title: "Analytics", description: "Website page views and referral sources.", dataset: "analytics", count: visits },
    can("report-prospects") && { title: "Prospects", description: "Website enquiries with contact details and status.", dataset: "prospects", count: prospects },
    can("report-receipts") && { title: "Receipts", description: "All receipts created during the selected period.", dataset: "receipts", count: count("RECEIPT") },
    can("report-quotations") && { title: "Quotations", description: "All quotations created during the selected period.", dataset: "quotations", count: count("QUOTATION") },
    can("report-invoices") && { title: "Invoices", description: "All invoices created during the selected period.", dataset: "invoices", count: count("INVOICE") },
    can("report-audit-trail") && { title: "Login and change audit trail", description: "Staff logins and recorded changes to portal records.", dataset: "audit-trail", count: auditLogs.length },
  ];
  const tiles = tileOptions.filter((tile): tile is DownloadTileProps => tile !== false);

  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Insights</p><h1>Reports</h1><p className="dashboard-note">Choose a date and time range for a separate Excel download from each report. Times use East Africa Time (UTC+03:00).</p></div>{canDownloadAllData(access.sections) && <Link className="dashboard-button download-all-button" href="/api/exports/all">↓ Download all data</Link>}</header>
    {canDownloadAllData(access.sections) && <section className="panel report-summary"><div className="panel-heading"><div><p className="eyebrow">Workbook contents</p><h3>All operational data</h3></div><span className="prototype-badge">Excel workbook</span></div><div className="report-sheet-grid">{["Reports", "Analytics", "Prospects", "Receipts", "Quotations", "Invoices"].map((sheet, index) => <article key={sheet}><span>{String(index + 1).padStart(2, "0")}</span><b>{sheet}</b></article>)}</div><p className="dashboard-note">Findings and audit trails are available from their separate report downloads.</p></section>}
    <section className="report-download-grid" aria-label="Download reports">
      {tiles.map((tile) => <DownloadTile key={tile.dataset} {...tile} />)}
      {tiles.length === 0 && <p className="empty-state">No report downloads have been assigned to this account.</p>}
    </section>
    {can("report-audit-trail") && <section className="panel table-panel audit-trail-panel"><div className="panel-heading"><div><p className="eyebrow">Access history</p><h3>Login and change audit trail</h3><p className="dashboard-note">Showing the latest {auditLogs.length} events.</p></div></div>{auditLogs.length === 0 ? <p className="empty-state">Successful staff logins and recorded changes will appear here.</p> : <div className="table-scroll"><table><thead><tr><th>Date and time</th><th>Staff</th><th>Action</th><th>Record</th><th>Change</th></tr></thead><tbody>{auditLogs.map((entry) => <tr key={entry.id}><td><time dateTime={entry.createdAt.toISOString()}>{entry.createdAt.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</time></td><td>{entry.actor?.name ?? "Former account"}<small className="table-subtext">{entry.actor?.email ?? ""}</small></td><td>{entry.action.replaceAll("_", " ")}</td><td>{entry.entityType}</td><td>{entry.summary}</td></tr>)}</tbody></table></div>}</section>}
  </main>;
}
