import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicSiteHeader } from "@/components/public-site-header";
import { CompanyBrand } from "@/components/company-brand";
import { WebsiteVisitTracker } from "@/components/website-visit-tracker";
import { PublicMediaGallery } from "@/components/public-media-gallery";
import { listPublicMedia, mediaFolders } from "@/lib/public-media";
import { prisma } from "@/lib/prisma";
import { solutions, type SolutionSlug } from "@/lib/solutions";

export const dynamic = "force-dynamic";

export default async function SolutionPage({ params }: PageProps<"/solutions/[slug]">) {
  const { slug } = await params;
  if (!Object.hasOwn(solutions, slug)) notFound();
  const solution = solutions[slug as SolutionSlug];
  const [media, company] = await Promise.all([
    listPublicMedia(mediaFolders[slug as SolutionSlug]),
    prisma.companyProfile.findUnique({ where: { companyId: 1 }, select: { address: true } }),
  ]);

  return <div className="site-shell">
    <WebsiteVisitTracker />
    <PublicSiteHeader />
    <main className="solution-main">
      <p className="eyebrow">Veteran Power Solutions Limited · Products and services</p><h1>{solution.title}</h1><p className="solution-intro">{solution.intro}</p>
      <div className={`solution-media-layout${media.length === 0 ? " no-media" : ""}`}>
        <div className="solution-columns"><section className="solution-panel"><p className="eyebrow">Products</p><h2>Available locally</h2><ul>{solution.products.map((product) => <li key={product}>{product}</li>)}</ul></section><section className="solution-panel solution-panel-accent"><p className="eyebrow">Services</p><h2>Help from planning to support</h2><ul>{solution.services.map((service) => <li key={service}>{service}</li>)}</ul></section></div>
        <PublicMediaGallery items={media} title={`${solution.title} media`} description="Photos, video, audio, and downloadable project files." />
      </div>
      <section className="solution-contact"><div><p className="eyebrow">Need a tailored solution?</p><h2>Talk with our team.</h2></div><Link className="button button-primary" href="/#contact">Request an enquiry <span aria-hidden="true">→</span></Link></section>
    </main>
    <footer className="site-footer"><Link className="brand site-brand" href="/" aria-label="Veteran Power Solutions Limited home"><CompanyBrand /></Link>{company?.address && <span>{company.address}</span>}<span>© 2018 Veteran Power Solutions Limited</span><Link href="/portfolio">Projects ↗</Link></footer>
  </div>;
}
