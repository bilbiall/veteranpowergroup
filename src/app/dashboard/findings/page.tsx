import { prisma } from "@/lib/prisma";
import { createFinding, updateFindingStatus } from "@/app/dashboard/actions";
import { requireSectionAccess } from "@/lib/prototype-auth";

export default async function FindingsPage({ searchParams }: PageProps<"/dashboard/findings">) {
  await requireSectionAccess("findings");
  const params = await searchParams;
  const findings = await prisma.finding.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Insights</p><h1>Findings</h1><p className="dashboard-note">Record observations, issues, and follow-up actions for the team.</p></div><span className="prototype-badge">{findings.length} records</span></header>
    {params.created === "1" && <p className="notice" role="status">Finding recorded.</p>}{params.updated === "1" && <p className="notice" role="status">Finding status updated.</p>}{params.error === "invalid" && <p className="notice notice-error" role="alert">Check the finding details and try again.</p>}
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Team notes</p><h3>All findings</h3></div></div>{findings.length === 0 ? <p className="empty-state">No findings recorded yet.</p> : <div className="table-scroll"><table><thead><tr><th>Finding</th><th>Priority</th><th>Recorded</th><th>Status</th></tr></thead><tbody>{findings.map((finding) => <tr key={finding.id}><td><b>{finding.title}</b><small className="table-subtext finding-details">{finding.details}</small></td><td><span className={`finding-priority priority-${finding.priority.toLowerCase()}`}>{finding.priority}</span></td><td>{finding.createdAt.toLocaleDateString("en")}</td><td><form action={updateFindingStatus} className="inline-status-form"><input type="hidden" name="id" value={finding.id} /><select name="status" defaultValue={finding.status} aria-label={`Status for ${finding.title}`}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select><button className="staff-action" type="submit">Save</button></form></td></tr>)}</tbody></table></div>}</section>
    <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Staff entry</p><h3>Record a finding</h3></div></div><form action={createFinding} className="prototype-form"><label>Title<input name="title" minLength={3} maxLength={160} required /></label><label>Priority<select name="priority" defaultValue="MEDIUM"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label><label className="finding-details-input">Details<textarea name="details" minLength={5} maxLength={3000} rows={4} required /></label><button className="dashboard-button" type="submit">Save finding</button></form></section>
  </main>;
}
