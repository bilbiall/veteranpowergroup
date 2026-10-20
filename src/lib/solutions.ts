export const solutions = {
  power: {
    title: "Power Solutions",
    intro: "Locally available products and practical services to support dependable power at home and work.",
    products: ["Power generation and backup equipment", "Inverters and battery storage", "Electrical distribution and protection"],
    services: ["Power needs assessment", "Supply and installation", "Inspection, maintenance, and support"],
  },
  solar: {
    title: "Solar Solutions",
    intro: "Solar products and services planned around your property, energy use, and budget.",
    products: ["Solar panels and mounting systems", "Solar inverters and battery storage", "Solar lighting and accessories"],
    services: ["Site and energy assessment", "Solar system supply and installation", "System checks and maintenance"],
  },
  borehole: {
    title: "Borehole Solutions",
    intro: "Borehole equipment and services to help deliver a reliable water supply for your site.",
    products: ["Submersible pumps and pump controls", "Pipes, fittings, and cabling", "Water storage and distribution equipment"],
    services: ["Borehole and site assessment", "Pump supply and installation", "Testing, maintenance, and support"],
  },
} as const;

export type SolutionSlug = keyof typeof solutions;
