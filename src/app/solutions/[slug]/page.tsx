import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicSiteHeader } from "@/components/public-site-header";
import { CompanyBrand } from "@/components/company-brand";
import { WebsiteVisitTracker } from "@/components/website-visit-tracker";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { PublicMediaGallery } from "@/components/public-media-gallery";
import { getCompanyProfileSummary } from "@/lib/company-profile";
import { listPublicMedia, mediaFolders } from "@/lib/public-media";
import { solutions, type SolutionSlug } from "@/lib/solutions";
import { jsonLd, siteName, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/solutions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!Object.hasOwn(solutions, slug)) return {};
  const solution = solutions[slug as SolutionSlug];
  return {
    title: solution.seoTitle,
    description: solution.seoDescription,
    keywords: [...solution.keywords],
    alternates: { canonical: `/solutions/${slug}` },
    openGraph: { type: "website", url: `/solutions/${slug}`, title: `${solution.seoTitle} | ${siteName}`, description: solution.seoDescription, images: ["/veteran-renewable-hero.png"] },
  };
}

export default async function SolutionPage({ params }: PageProps<"/solutions/[slug]">) {
  const { slug } = await params;
  if (!Object.hasOwn(solutions, slug)) notFound();
  const solution = solutions[slug as SolutionSlug];
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: solution.title,
    description: solution.seoDescription,
    url: `${siteUrl}/solutions/${slug}`,
    areaServed: { "@type": "Country", name: "Kenya" },
    provider: { "@type": "LocalBusiness", name: siteName, url: siteUrl },
    hasOfferCatalog: { "@type": "OfferCatalog", name: `${solution.title} products and services`, itemListElement: [...solution.products, ...solution.services].map((item) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: item } })) },
  };
  const [media, company] = await Promise.all([
    listPublicMedia(mediaFolders[slug as SolutionSlug]),
    getCompanyProfileSummary(),
  ]);

  return <div className="site-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(serviceSchema) }} />
    <WebsiteVisitTracker />
    <WhatsAppButton />
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
