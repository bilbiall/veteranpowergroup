import { prisma } from "@/lib/prisma";
import { requireSectionAccess } from "@/lib/prototype-auth";

function getThirtyDayCutoff() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

export default async function AnalyticsPage() {
  await requireSectionAccess("analytics");
  const since = getThirtyDayCutoff();
  const [allTimeViews, visits] = await Promise.all([
    prisma.websiteVisit.count(),
    prisma.websiteVisit.findMany({ where: { visitedAt: { gte: since } }, select: { path: true, referrer: true } }),
  ]);
  const recentViews = visits.length;
  const pageCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  for (const visit of visits) {
    pageCounts.set(visit.path, (pageCounts.get(visit.path) ?? 0) + 1);
    if (visit.referrer) sourceCounts.set(visit.referrer, (sourceCounts.get(visit.referrer) ?? 0) + 1);
  }
  const pages = [...pageCounts].sort((a, b) => b[1] - a[1]);
  const sources = [...sourceCounts].sort((a, b) => b[1] - a[1]);
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Insights</p><h1>Website analytics</h1><p className="dashboard-note">Page views recorded on the public website. Referrers are stored as host names only.</p></div><span className="prototype-badge">Last 30 days</span></header>
    <section className="metrics-grid analytics-metrics"><article className="metric-card"><div className="metric-head">Page views · 30 days</div><strong>{recentViews.toLocaleString("en")}</strong><p>Recorded website page views</p></article><article className="metric-card"><div className="metric-head">Page views · all time</div><strong>{allTimeViews.toLocaleString("en")}</strong><p>Since tracking was enabled</p></article><article className="metric-card"><div className="metric-head">Pages visited</div><strong>{pages.length.toLocaleString("en")}</strong><p>Distinct public pages · 30 days</p></article></section>
    <div className="dashboard-lower analytics-tables"><section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Popular pages</p><h3>Page views</h3></div></div>{pages.length === 0 ? <p className="empty-state">Website views will appear here as visitors browse.</p> : <div className="table-scroll"><table><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>{pages.map(([path, count]) => <tr key={path}><td>{path}</td><td>{count.toLocaleString("en")}</td></tr>)}</tbody></table></div>}</section>
      <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Referral sources</p><h3>Referrers</h3></div></div>{sources.length === 0 ? <p className="empty-state">No external referral sources recorded yet.</p> : <div className="table-scroll"><table><thead><tr><th>Source</th><th>Views</th></tr></thead><tbody>{sources.map(([source, count]) => <tr key={source}><td>{source}</td><td>{count.toLocaleString("en")}</td></tr>)}</tbody></table></div>}</section></div>
  </main>;
}
