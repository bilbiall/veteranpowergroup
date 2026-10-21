export const solutions = {
  power: {
    title: "Power Solutions",
    seoTitle: "Electrical Wiring, Inverters, Batteries & Generators in Nairobi",
    seoDescription: "Electrical installation and wiring, hybrid and off-grid inverters, gel, tubular and lithium batteries, and backup generators supplied and installed in Nairobi and across Kenya.",
    keywords: ["electrical installation Nairobi", "electrical wiring Kenya", "inverters Kenya", "backup power", "generators Kenya", "batteries Kenya"],
    intro: "Locally available products and practical services to support dependable power at home and work.",
    products: ["Power generation and backup equipment", "Hybrid, off-grid and grid-tie inverters", "Gel, tubular and lithium battery storage", "Electrical distribution, wiring and protection"],
    services: ["Power needs assessment", "Electrical wiring and installation", "Supply and installation", "Inspection, maintenance, and support"],
  },
  solar: {
    title: "Solar Solutions",
    seoTitle: "Solar Power Systems & Off-Grid Installation in Kenya",
    seoDescription: "Solar panels, hybrid and off-grid inverters, solar batteries and full installation for homes, farms and businesses in Nairobi and across Kenya.",
    keywords: ["solar power Kenya", "solar installation Nairobi", "off-grid solar systems", "solar batteries", "solar inverters", "solar water pumps"],
    intro: "Solar products and services planned around your property, energy use, and budget, including off-grid solar systems for sites without grid power.",
    products: ["Solar panels and mounting systems", "Solar inverters and battery storage", "Off-grid and hybrid solar systems", "Solar water pumping and lighting accessories"],
    services: ["Site and energy assessment", "Solar system supply and installation", "Off-grid system design", "System checks and maintenance"],
  },
  borehole: {
    title: "Borehole Solutions",
    seoTitle: "Borehole Solutions & Water Pumps in Kenya",
    seoDescription: "Submersible and solar water pumps, pump controls, pipes, cabling and storage for borehole water systems, supplied and installed in Nairobi and across Kenya.",
    keywords: ["borehole solutions Kenya", "water pumps Kenya", "submersible pumps Nairobi", "solar water pump", "borehole pump installation"],
    intro: "Borehole equipment and services to help deliver a reliable water supply for your site, with electric and solar-powered water pumps.",
    products: ["Submersible and solar water pumps", "Pump controls and electrical wiring", "Pipes, fittings, and cabling", "Water storage and distribution equipment"],
    services: ["Borehole and site assessment", "Water pump supply and installation", "Testing, maintenance, and support"],
  },
} as const;

export type SolutionSlug = keyof typeof solutions;
