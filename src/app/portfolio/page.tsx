import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteHeader } from "@/components/public-site-header";
import { CompanyBrand } from "@/components/company-brand";
import { WebsiteVisitTracker } from "@/components/website-visit-tracker";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { PublicMediaGallery } from "@/components/public-media-gallery";
import { listPublicMedia, mediaFolders } from "@/lib/public-media";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Solar, Borehole & Electrical Projects in Kenya",
  description: "Completed solar installations, borehole and water pump systems, inverter and battery setups and electrical projects by Veteran Power Solutions across Kenya.",
  alternates: { canonical: "/portfolio" },
};

export default async function PortfolioPage() {
  const [projects, powerMedia, solarMedia, boreholeMedia, projectReports, company] = await Promise.all([
    prisma.portfolioProject.findMany({ where: { isPublished: true }, orderBy: [{ completionYear: "desc" }, { createdAt: "desc" }] }),
    listPublicMedia(mediaFolders.power),
    listPublicMedia(mediaFolders.solar),
    listPublicMedia(mediaFolders.borehole),
    listPublicMedia(mediaFolders.reports),
    prisma.companyProfile.findUnique({ where: { companyId: 1 }, select: { address: true } }),
  ]);
  return <div className="site-shell">
    <WebsiteVisitTracker />
    <WhatsAppButton />
    <PublicSiteHeader />
    <main className="portfolio-main"><p className="eyebrow">Projects and portfolio</p><h1>Work in the field.</h1><p className="portfolio-intro">A look at projects completed by Veteran Power Solutions Limited.</p>
      {projects.length === 0 ? <section className="portfolio-empty"><h2>Projects are being added.</h2><p>Contact our team to discuss a power, solar, or borehole solution for your site.</p><Link className="button button-primary" href="/#contact">Contact us <span aria-hidden="true">→</span></Link></section> : <div className="live-project-grid">{projects.map((project) => <article className="live-project-card" key={project.id}><div className="live-project-meta"><span>{project.category}</span>{project.completionYear && <span>{project.completionYear}</span>}</div><h2>{project.title}</h2><p>{project.summary}</p>{project.location && <span className="live-project-location">{project.location}</span>}</article>)}</div>}
      <PublicMediaGallery items={[...powerMedia, ...solarMedia, ...boreholeMedia]} title="Project photos, video, and audio" description="Media from Power, Solar, and Borehole Solutions projects." />
      <PublicMediaGallery items={projectReports} title="Project reports" description="Open or download reports and supporting files." />
    </main>
    <footer className="site-footer"><Link className="brand site-brand" href="/" aria-label="Veteran Power Solutions Limited home"><CompanyBrand /></Link>{company?.address && <span>{company.address}</span>}<span>© 2018 Veteran Power Solutions Limited</span><Link href="/#contact">Contact us ↗</Link></footer>
  </div>;
}
