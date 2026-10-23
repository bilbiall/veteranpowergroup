import { addPortfolioProjectMedia, createPortfolioProject, setPortfolioProjectPublished } from "@/app/dashboard/actions";
import { prisma } from "@/lib/prisma";
import { requirePrototypeSession } from "@/lib/prototype-auth";

export default async function PortfolioManagerPage({ searchParams }: PageProps<"/dashboard/portfolio">) {
  await requirePrototypeSession();
  const params = await searchParams;
  const projects = await prisma.portfolioProject.findMany({ orderBy: { createdAt: "desc" } });
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Website content</p><h1>Project portfolio</h1><p className="dashboard-note">Published projects appear on the public website portfolio.</p></div><a className="prototype-badge" href="/portfolio">View live page ↗</a></header>
    {params.created === "1" && <p className="notice" role="status">Project added to the portfolio.</p>}{params.media === "added" && <p className="notice" role="status">Project media uploaded.</p>}{params.updated === "1" && <p className="notice" role="status">Project publication status updated.</p>}{params.error === "invalid" && <p className="notice notice-error" role="alert">Check the project details and try again.</p>}{params.error === "media" && <p className="notice notice-error" role="alert">Upload up to 10 supported files with a combined size of 3 MB or less.</p>}
    <section className="panel table-panel">
      <div className="panel-heading"><div><p className="eyebrow">Website projects</p><h3>All projects</h3></div></div>
      {projects.length === 0 ? <p className="empty-state">No projects added yet.</p> : <div className="table-scroll"><table>
        <thead><tr><th>Project</th><th>Category</th><th>Location</th><th>Year</th><th>Project media</th><th>Website</th></tr></thead>
        <tbody>{projects.map((project) => <tr key={project.id}>
          <td>{project.title}<small className="table-subtext">{project.summary}</small></td><td>{project.category}</td><td>{project.location ?? "—"}</td><td>{project.completionYear ?? "—"}</td>
          <td><form action={addPortfolioProjectMedia} className="portfolio-media-upload-form"><input type="hidden" name="id" value={project.id} /><label>Upload files<input name="media" type="file" multiple accept="image/avif,image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm,application/pdf" /></label><small>Up to 10 files, 3 MB total per upload.</small><button className="dashboard-button" type="submit">Upload media</button></form></td>
          <td><form action={setPortfolioProjectPublished}><input type="hidden" name="id" value={project.id} /><input type="hidden" name="isPublished" value={String(!project.isPublished)} /><button className={`account-status ${project.isPublished ? "is-active" : "is-disabled"} project-publish-button`} type="submit">{project.isPublished ? "Published · unpublish" : "Draft · publish"}</button></form></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    <section className="panel form-panel">
      <div className="panel-heading"><div><p className="eyebrow">New portfolio entry</p><h3>Add a completed project</h3></div></div>
      <form action={createPortfolioProject} className="prototype-form">
        <label>Project name<input name="title" required minLength={3} maxLength={160} /></label>
        <label>Category<select name="category" required defaultValue="Power Solutions"><option>Power Solutions</option><option>Solar Solutions</option><option>Borehole Solutions</option></select></label>
        <label>Location<input name="location" maxLength={160} /></label>
        <label>Completion year<input name="completionYear" type="number" min="1980" max="2100" /></label>
        <label className="finding-details-input">Project summary<textarea name="summary" rows={4} required minLength={10} maxLength={2000} /></label>
        <label className="finding-details-input">Project media (optional)<input name="media" type="file" multiple accept="image/avif,image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm,application/pdf" /><small>Up to 10 photos, videos, audio files, or PDFs; 3 MB total per upload.</small></label>
        <label className="checkbox-label"><input type="checkbox" name="isPublished" defaultChecked /> Publish on the website</label>
        <button className="dashboard-button" type="submit">Save project</button>
      </form>
    </section>
  </main>;
}
