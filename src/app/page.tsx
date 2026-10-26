import Link from "next/link";
import { PublicSiteHeader } from "@/components/public-site-header";
import { CompanyBrand } from "@/components/company-brand";
import { PublicMediaGallery } from "@/components/public-media-gallery";
import { WebsiteVisitTracker } from "@/components/website-visit-tracker";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { submitWebsiteEnquiry } from "./actions";
import { getCompanyProfileSummary } from "@/lib/company-profile";
import { listPublicMedia, mediaFolders } from "@/lib/public-media";
import { business, jsonLd, siteName, siteUrl } from "@/lib/seo";

const solutions = [
  ["01", "Power Solutions", "Power products and services for homes, businesses, farms, and institutions.", "/solutions/power"],
  ["02", "Solar Solutions", "Solar products and installation, matched to the needs of your site.", "/solutions/solar"],
  ["03", "Borehole Solutions", "Borehole solutions and related equipment for water-access needs.", "/solutions/borehole"],
];

const productAreas = [
  ["Solar Power Systems", "Solar modules and related equipment for generating electricity from solar energy.", "/solutions/solar"],
  ["Battery Solutions", "Gel, tubular, and lithium batteries for applications that need energy storage.", "/solutions/power"],
  ["Inverter Solutions", "Hybrid, off-grid, and grid-tie inverter options for different system configurations.", "/solutions/power"],
  ["Generator Solutions", "Power-generation equipment for an additional or alternative source of electricity.", "/solutions/power"],
  ["Borehole Solutions", "Products and equipment to support water-access requirements.", "/solutions/borehole"],
  ["Electrical Solutions", "Electrical wiring, installation, distribution and protection for homes, businesses and other applications.", "/solutions/power"],
];

const useCases = [
  ["Keep a business running", "Bring suitable generation, storage, and inverter options together around your business power requirements."],
  ["Build an off-grid system", "Explore off-grid inverter and battery options for sites without a grid connection or needing an independent system."],
  ["Make use of solar power", "Pair solar modules with an appropriate battery and inverter configuration to generate and store electricity."],
  ["Plan for backup power", "Consider generators, batteries, and other components around the equipment and power you need to support."],
  ["Support water access", "Discuss borehole requirements and the related equipment for your application."],
];

const reasons = [
  ["Experience since 2018", "Operating in the power-solutions space since 2018; incorporated as a limited company on 30 September 2022."],
  ["Supply and installation", "We supply equipment and provide installation, helping turn components into a working solution."],
  ["Multiple technologies", "Solar, batteries, hybrid and off-grid inverters, grid-tie inverters, generators, and borehole solutions."],
  ["Matched to the application", "The right system depends on what you need it to do. We help match available technologies to the intended use."],
];

const serviceOptions = ["Power Solutions", "Solar Solutions", "Borehole Solutions"];

const businessSchema = (address?: string | null) => ({
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "ElectricalContractor"],
  "@id": `${siteUrl}/#business`,
  name: siteName,
  description: "Supply and installation of solar power systems, batteries, inverters, generators, water pumps, borehole solutions and electrical wiring in Nairobi and across Kenya.",
  url: siteUrl,
  logo: business.logo,
  image: business.image,
  telephone: business.phone,
  email: business.email,
  foundingDate: "2018",
  slogan: "We light your world",
  address: { "@type": "PostalAddress", streetAddress: address || business.streetAddress, addressLocality: business.locality, addressCountry: business.country },
  areaServed: [{ "@type": "City", name: "Nairobi" }, { "@type": "Country", name: "Kenya" }],
  sameAs: [business.facebook],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Power, solar and borehole solutions",
    itemListElement: ["Solar solutions and installation", "Off-grid solar systems", "Power solutions", "Electrical solutions, wiring and installation", "Inverter solutions", "Battery solutions", "Water pumps and borehole solutions", "Generators and backup power"].map((name) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name } })),
  },
});

export default async function Home({ searchParams }: PageProps<"/">) {
  const [params, company, aboutMedia] = await Promise.all([
    searchParams,
    getCompanyProfileSummary(),
    listPublicMedia(mediaFolders.about),
  ]);
  return (
    <div className="site-shell site-shell-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(businessSchema(company?.address)) }} />
      <WebsiteVisitTracker />
      <WhatsAppButton />
      <PublicSiteHeader />
      <main id="top">
        <section className="hero-section company-hero about-hero" id="about">
          <div className="hero-copy"><p className="eyebrow">About Veteran Power Solutions Limited · Serving Kenya since 2018</p><h1>Solar, borehole, electrical and off-grid power solutions in Kenya for <em>your needs.</em></h1><p className="hero-proof">Solar · Batteries · Inverters · Water Pumps · Electrical Wiring · Generators · Borehole Solutions</p><div className="hero-actions"><a className="button button-primary" href="#contact">Discuss your requirements <span aria-hidden="true">→</span></a></div></div>
          <aside className="hero-contact-panel" aria-labelledby="hero-contact-title"><p className="eyebrow">Let&apos;s discuss your power requirements</p><h2 id="hero-contact-title">Tell us what<br /><em>you need.</em></h2><p className="hero-contact-prompt">Share what you need to power, your current setup, and the challenge you are experiencing. Our team can help you identify a suitable solution.</p><div className="hero-contact-details"><p>Shem Plaza, Lusaka Road, Industrial Area, Nairobi,<br />Opposite ASL</p><a href="mailto:veteranpowergroup@gmail.com">veteranpowergroup@gmail.com</a><a href="tel:+254707734670">+254 707 734 670</a></div></aside>
        </section>
        <section className="intro-section about-detail" aria-label="About Veteran Power Solutions Limited">
          <div className="about-content-layout">
            <PublicMediaGallery items={aboutMedia} eyebrow="Our Location" title="Visit our office" description={"Find us at Shem Plaza, Lusaka Road, Industrial Area, Nairobi.\nOpposite ASL."} />
            <div className="about-details-column">
            <div className="about-copy">
            <p><strong>Veteran Power Solutions Limited</strong> is a Kenyan power and water-solutions company providing the <strong>supply and installation of practical energy and borehole solutions</strong> for customers with diverse power and water-access needs.</p>
            <p>Established in <strong>2018 as a registered business name</strong>, the company transitioned into a <strong>limited company on 30 September 2022</strong>, building on its experience in delivering solutions across solar power, energy storage, power conversion, backup generation and borehole applications.</p>
            <p>Our solutions include the <strong>supply and installation of solar modules, gel, tubular and lithium batteries, hybrid, off-grid and grid-tie inverters, generators, borehole solutions and related accessories</strong>. By bringing these solutions together, we help customers address practical requirements such as generating electricity, storing energy, configuring independent or grid-connected power systems, providing alternative power sources and developing borehole solutions.</p>
            <p>At Veteran Power Solutions, we understand that every application has different requirements. Our focus is therefore on <strong>matching the appropriate equipment and solution to the customer&apos;s needs</strong>, followed by professional installation and implementation.</p>
            <p>Whether you are looking to <strong>build a solar power system, add battery storage, establish an off-grid solution, integrate a grid-tie or hybrid inverter, provide backup generation, or develop a borehole solution</strong>, Veteran Power Solutions is positioned to help you move from a power or water-access requirement to a practical installed solution.</p>
          </div>
          <div className="about-core-solutions">
            <h3>Our Core Solutions</h3>
            <ul>
              <li><strong>Solar Modules &amp; Solar Solutions</strong></li>
              <li><strong>Gel, Tubular &amp; Lithium Batteries</strong></li>
              <li><strong>Hybrid, Off-Grid &amp; Grid-Tie Inverters</strong></li>
              <li><strong>Generator Solutions</strong></li>
              <li><strong>Borehole Solutions</strong></li>
              <li><strong>Related Power &amp; Installation Accessories</strong></li>
            </ul>
          </div>
          <div className="about-company-details">
            <div><h3>Our Location</h3><p>Shem Plaza, Lusaka Road, Industrial Area, Nairobi<br /><strong>Opposite ASL</strong></p></div>
            <div><h3>Call</h3><a href="tel:+254707734670">+254 707 734 670</a></div>
            <div><h3>Email</h3><a href="mailto:veteranpowergroup@gmail.com">veteranpowergroup@gmail.com</a></div>
          </div>
          <div className="about-brand-line"><h3>Veteran Power Solutions Limited</h3><p><strong>Established 2018 | Limited Company since 30 September 2022</strong></p><p className="about-tagline">“WE LIGHT YOUR WORLD”</p></div>
            </div>
          </div>
        </section>

        <section className="services-section" id="services"><div className="section-heading"><div><p className="eyebrow">Explore our services</p><h2>Three ways to find <span>your solution.</span></h2></div><span className="section-index">01 — 03</span></div><div className="service-grid solution-grid">{solutions.map(([number, title, description, href], index) => <article className={`service-card${index === 0 ? " service-card-featured" : ""}`} key={number}><span className="card-number">{number}</span><h3>{title}</h3><p>{description}</p><Link href={href} aria-label={`Explore ${title}`}>Explore ↗</Link></article>)}</div></section>

        <section className="product-areas-section" id="products"><div className="section-heading"><div><p className="eyebrow">Products and systems</p><h2>Equipment for <span>your application.</span></h2></div></div><div className="product-areas-grid">{productAreas.map(([title, description, href], index) => <article className="product-area-card" key={title}><span className="product-area-number">0{index + 1}</span><h3>{title}</h3><p>{description}</p><Link href={href}>Explore solution <span aria-hidden="true">↗</span></Link></article>)}</div></section>

        <section className="use-cases-section"><div className="section-heading"><div><p className="eyebrow">Practical use cases</p><h2>Start with what you <span>need to do.</span></h2></div></div><div className="use-case-grid">{useCases.map(([title, description], index) => <article className="use-case-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>

        <section className="why-section"><div className="why-heading"><p className="eyebrow">Why Veteran Power Solutions?</p><h2>Technology that fits <span>the task.</span></h2><p>We help you consider the products and system configuration around your requirements.</p></div><div className="why-grid">{reasons.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>

        <section className="portfolio-callout portfolio-home-callout"><div className="portfolio-callout-copy"><CompanyBrand className="portfolio-callout-logo" /><p className="eyebrow">Live projects and portfolio</p><h3>See our work in the field.</h3><p>Explore project updates, completed work, and shared media.</p></div><div className="portfolio-callout-actions"><Link className="text-link" href="/portfolio">View projects <span aria-hidden="true">↗</span></Link><a className="portfolio-facebook-link" href="https://web.facebook.com/veteranmailu" target="_blank" rel="noreferrer" aria-label="Follow Veteran Power Solutions on Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 21v-8.2h2.8l.4-3.2h-3.2v-2c0-.9.3-1.6 1.6-1.6H17V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.5v3.2h2.8V21h3.4Z" /></svg><span>Facebook</span></a></div></section>

        <section className="contact-section" id="contact">
          <div><p className="eyebrow">Let&apos;s discuss your power requirements</p><h2>Tell us what<br /><em>you need.</em></h2><p className="contact-prompt">Share what you need to power, your current setup, and the challenge you are experiencing. Our team can help you identify a suitable solution.</p><p className="contact-details">{company?.address && <span>{company.address}</span>}<a href="mailto:veteranpowergroup@gmail.com">veteranpowergroup@gmail.com</a><a href="tel:+254707734670">+254 707 734 670</a></p></div>
          <div className="contact-form-wrap">{params.contact === "sent" ? <p className="contact-feedback" role="status">Thank you. Your enquiry has been sent to our team.</p> : <form action={submitWebsiteEnquiry} className="contact-form"><p className="eyebrow">Send an enquiry</p>{params.contact === "invalid" && <p className="contact-feedback" role="alert">Please check the required fields and try again.</p>}<label>Name<input name="name" autoComplete="name" minLength={2} maxLength={120} required /></label><label>Email<input name="email" type="email" autoComplete="email" /></label><label>Phone<input name="phone" type="tel" maxLength={40} /></label><fieldset className="contact-interest"><legend>Interested in <span>(select all that apply)</span></legend><div className="contact-interest-options">{serviceOptions.map((option) => <label key={option}><input name="serviceInterest" type="checkbox" value={option} />{option}</label>)}</div></fieldset><label className="contact-message">How can we help?<textarea name="message" minLength={10} maxLength={2000} rows={4} required /></label><label className="website-honeypot" aria-hidden="true">Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label><button className="button button-light" type="submit">Send enquiry <span aria-hidden="true">→</span></button></form>}</div>
        </section>
      </main>
      <footer className="site-footer"><a className="brand site-brand" href="#top" aria-label="Veteran Power Solutions Limited home"><CompanyBrand /></a>{company?.address && <span>{company.address}</span>}<span>© 2018 Veteran Power Solutions Limited</span><span>We light your world.</span></footer>
    </div>
  );
}
