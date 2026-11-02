import { addPortfolioProjectMedia, createPortfolioProject, deletePortfolioProject, deletePortfolioProjects, setPortfolioProjectPublished } from "@/app/dashboard/actions";
import { DeleteProjectForm } from "@/app/dashboard/portfolio/delete-project-form";
import { BulkDeleteProjects } from "@/app/dashboard/portfolio/bulk-delete-projects";
import { prisma } from "@/lib/prisma";
import { requireSectionAccess } from "@/lib/prototype-auth";

export default async function PortfolioManagerPage({ searchParams }: PageProps<"/dashboard/portfolio">) {
  await requireSectionAccess("portfolio");
  const params = await searchParams;
  const projects = await prisma.portfolioProject.findMany({ orderBy: { createdAt: "desc" } });
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Website content</p><h1>Project portfolio</h1><p className="dashboard-note">Published projects appear on the public website portfolio.</p></div><a className="prototype-badge" href="/portfolio">View live page ↗</a></header>
    {params.created === "1" && <p className="notice" role="status">Project added to the portfolio.</p>}{params.media === "added" && <p className="notice" role="status">Project media uploaded.</p>}{params.updated === "1" && <p className="notice" role="status">Project publication status updated.</p>}{params.deleted && <p className="notice" role="status">{params.deleted} portfolio project{params.deleted === "1" ? "" : "s"} deleted.</p>}{params.error === "notfound" && <p className="notice notice-error" role="alert">That project no longer exists.</p>}{params.error === "invalid" && <p className="notice notice-error" role="alert">Check the project details and try again.</p>}{params.error === "media" && <p className="notice notice-error" role="alert">Upload up to 10 supported files per upload.</p>}
    <section className="panel table-panel">
      <div className="panel-heading"><div><p className="eyebrow">Website projects</p><h3>All projects</h3></div><BulkDeleteProjects action={deletePortfolioProjects} projectCount={projects.length} /></div>
      {projects.length === 0 ? <p className="empty-state">No projects added yet.</p> : <div className="table-scroll"><table className="portfolio-projects-table">
        <thead><tr><th>Select</th><th>Project</th><th>Category</th><th>Location</th><th>Year</th><th>Project media</th><th>Website</th></tr></thead>
        <tbody>{projects.map((project) => <tr key={project.id}>
          <td><input form="bulk-delete-projects" type="checkbox" name="projectIds" value={project.id} aria-label={`Select ${project.title}`} /></td><td>{project.title}<small className="table-subtext">{project.summary}</small></td><td>{project.category}</td><td>{project.location ?? "—"}</td><td>{project.completionYear ?? "—"}</td>
          <td><form action={addPortfolioProjectMedia} className="portfolio-media-upload-form"><input type="hidden" name="id" value={project.id} /><label>Upload files<input name="media" type="file" multiple accept="image/avif,image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm,application/pdf" /></label><small>Up to 10 files per upload. No app-level file size limit.</small><button className="dashboard-button" type="submit">Upload media</button></form></td>
          <td><div className="portfolio-publish-controls"><form action={setPortfolioProjectPublished}><input type="hidden" name="id" value={project.id} /><input type="hidden" name="isPublished" value={String(!project.isPublished)} /><button className={`account-status ${project.isPublished ? "is-active" : "is-disabled"} project-publish-button`} type="submit">{project.isPublished ? "Published · unpublish" : "Draft · publish"}</button></form><DeleteProjectForm action={deletePortfolioProject} projectId={project.id} projectTitle={project.title} /></div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    <section className="panel form-panel">
      <div className="panel-heading"><div><p className="eyebrow">New portfolio entry</p><h3>Add a completed project</h3></div></div>
      <form action={createPortfolioProject} className="prototype-form">
        <label>Project name<input name="title" required minLength={3} maxLength={160} /></label>
        <fieldset className="portfolio-category-options"><legend>Category <span>Select all that apply</span></legend><label className="checkbox-label"><input type="checkbox" name="category" value="Power Solutions" />Power Solutions</label><label className="checkbox-label"><input type="checkbox" name="category" value="Solar Solutions" />Solar Solutions</label><label className="checkbox-label"><input type="checkbox" name="category" value="Borehole Solutions" />Borehole Solutions</label></fieldset>
        <label>Location<input name="location" maxLength={160} /></label>
        <label>Completion year<input name="completionYear" type="number" min="1980" max="2100" /></label>
        <label className="finding-details-input">Project summary<textarea name="summary" rows={4} required minLength={10} maxLength={2000} /></label>
        <label className="finding-details-input">Project media (optional)<input name="media" type="file" multiple accept="image/avif,image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm,application/pdf" /><small>Up to 10 photos, videos, audio files, or PDFs per upload. No app-level file size limit.</small></label>
        <label className="checkbox-label"><input type="checkbox" name="isPublished" defaultChecked /> Publish on the website</label>
        <div className="portfolio-form-actions"><button className="dashboard-button" type="submit">Save project</button><button className="dashboard-button portfolio-clear-button" type="reset">Discard draft</button></div>
      </form>
    </section>
  </main>;
}
