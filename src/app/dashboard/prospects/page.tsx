import { prisma } from "@/lib/prisma";
import { requireSectionAccess } from "@/lib/prototype-auth";
import { updateProspectStatus } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function ProspectsPage({ searchParams }: PageProps<"/dashboard/prospects">) {
  await requireSectionAccess("prospects");
  const params = await searchParams;
  const prospects = await prisma.prospect.findMany({ orderBy: { createdAt: "desc" } });
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Workspace</p><h1>Customer enquiries</h1><p className="dashboard-note">All website enquiries are listed here, newest first, for your team to follow up.</p></div><span className="prototype-badge">{prospects.length} enquiries</span></header>
    {params.updated === "1" && <p className="notice" role="status">Prospect status updated.</p>}
    {params.error === "invalid" && <p className="notice notice-error" role="alert">Could not update that prospect.</p>}
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Website enquiries</p><h3>All customer enquiries</h3><p className="dashboard-note">Showing all {prospects.length} records.</p></div></div>
      {prospects.length === 0 ? <p className="empty-state">No customer enquiries have been received yet.</p> : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Contact</th><th>Interest</th><th>Message</th><th>Received</th><th>Status</th></tr></thead><tbody>{prospects.map((prospect) => <tr key={prospect.id}><td>{prospect.name}{prospect.company && <small className="table-subtext">{prospect.company}</small>}</td><td>{prospect.email ?? "—"}<small className="table-subtext">{prospect.phone ?? ""}</small></td><td>{prospect.serviceInterest ?? "—"}</td><td className="prospect-message-cell">{prospect.message}</td><td>{prospect.createdAt.toLocaleDateString("en")}</td><td><form action={updateProspectStatus} className="inline-status-form"><input type="hidden" name="id" value={prospect.id} /><select name="status" defaultValue={prospect.status} aria-label={`Status for ${prospect.name}`}><option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="QUALIFIED">Qualified</option><option value="CONVERTED">Converted</option><option value="CLOSED">Closed</option></select><button className="staff-action" type="submit">Save</button></form></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
