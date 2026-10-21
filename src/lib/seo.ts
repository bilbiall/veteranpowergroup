import { publicSiteUrl } from "@/lib/surface-urls";

export const siteName = "Veteran Power Solutions Limited";

export const siteUrl = publicSiteUrl.replace(/\/$/, "");

export const siteKeywords = [
  "Veteran Power Solutions Kenya",
  "power solutions Nairobi",
  "electrical solutions Kenya",
  "solar solutions Kenya",
  "solar power Kenya",
  "solar installation Nairobi",
  "battery solutions Kenya",
  "inverter solutions Kenya",
  "borehole solutions Nairobi",
  "borehole solutions Kenya",
  "borehole water pumps",
  "water pump installation Kenya",
  "submersible pumps Nairobi",
  "electrical installation Nairobi",
  "electrical wiring Kenya",
  "inverters Kenya",
  "hybrid inverter Kenya",
  "hybrid inverters",
  "off-grid solar systems",
  "solar batteries Kenya",
  "lithium battery Kenya",
  "lithium batteries",
  "gel batteries",
  "tubular batteries",
  "generators Kenya",
  "backup power",
  "Veteran Power Solutions",
];

export const business = {
  phone: "+254707734670",
  email: "veteranpowergroup@gmail.com",
  streetAddress: "Shem Plaza, Lusaka Road, Industrial Area",
  locality: "Nairobi",
  country: "KE",
  facebook: "https://web.facebook.com/veteranmailu",
  logo: `${siteUrl}/veteran-power-solutions-logo.png`,
  image: `${siteUrl}/veteran-renewable-hero.png`,
};

export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
