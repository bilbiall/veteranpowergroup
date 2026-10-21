export const solutions = {
  power: {
    title: "Power Solutions",
    seoTitle: "Power & Electrical Solutions in Nairobi",
    seoDescription: "Power and electrical solutions in Nairobi and across Kenya, including electrical wiring, hybrid inverters, battery storage and backup generators supplied and installed.",
    keywords: ["power solutions Nairobi", "electrical solutions Kenya", "electrical installation Nairobi", "electrical wiring Kenya", "inverter solutions Kenya", "battery solutions Kenya", "backup power", "generators Kenya"],
    intro: "Locally available products and practical services to support dependable power at home and work.",
    products: ["Power generation and backup equipment", "Hybrid, off-grid and grid-tie inverters", "Gel, tubular and lithium battery storage", "Electrical distribution, wiring and protection"],
    services: ["Power needs assessment", "Electrical wiring and installation", "Supply and installation", "Inspection, maintenance, and support"],
  },
  solar: {
    title: "Solar Solutions",
    seoTitle: "Solar Solutions & Installation in Kenya",
    seoDescription: "Solar solutions for homes, farms and businesses in Nairobi and across Kenya, including solar panels, off-grid systems, inverters, batteries and installation.",
    keywords: ["solar solutions Kenya", "solar power Kenya", "solar panel installation Kenya", "solar installation Nairobi", "off-grid solar systems", "solar batteries", "solar inverters", "solar water pumps"],
    intro: "Solar products and services planned around your property, energy use, and budget, including off-grid solar systems for sites without grid power.",
    products: ["Solar panels and mounting systems", "Solar inverters and battery storage", "Off-grid and hybrid solar systems", "Solar water pumping and lighting accessories"],
    services: ["Site and energy assessment", "Solar system supply and installation", "Off-grid system design", "System checks and maintenance"],
  },
  borehole: {
    title: "Borehole Solutions",
    seoTitle: "Borehole Solutions & Water Pumps in Kenya",
    seoDescription: "Borehole solutions in Nairobi and across Kenya, with submersible and solar water pumps, controls, pipes, cabling and water storage supplied and installed.",
    keywords: ["borehole solutions Kenya", "borehole solutions Nairobi", "water pump installation Kenya", "water pumps Kenya", "submersible pumps Nairobi", "solar water pump", "borehole pump installation"],
    intro: "Borehole equipment and services to help deliver a reliable water supply for your site, with electric and solar-powered water pumps.",
    products: ["Submersible and solar water pumps", "Pump controls and electrical wiring", "Pipes, fittings, and cabling", "Water storage and distribution equipment"],
    services: ["Borehole and site assessment", "Water pump supply and installation", "Testing, maintenance, and support"],
  },
} as const;

export type SolutionSlug = keyof typeof solutions;
