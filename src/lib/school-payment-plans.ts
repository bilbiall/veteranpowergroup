export const schoolPaymentPlans = [
  {
    id: "power",
    name: "Essential backup power",
    category: "Power Solutions",
    scope: "10 kVA silent diesel generator with ATS, protected essential-load changeover, basic cabling, installation, load test, and remote-site mobilisation. Size for essential circuits only until the school load is audited.",
    total: 365_000,
    sourceLabel: "Kenyan supplier listing: 10 kVA silent diesel generator with ATS at KSh 180,000; remaining lines are provisional site, installation, and remote-logistics allowances.",
    sourceUrl: "https://colcalmachinery.co.ke/product-category/generators/",
    stages: [
      { percent: 30, label: "Site check, secure base, and mobilisation" },
      { percent: 50, label: "Generator, ATS, protection, and installation" },
      { percent: 20, label: "Load test, staff orientation, and handover" },
    ],
  },
  {
    id: "solar",
    name: "School hybrid solar",
    category: "Solar Solutions",
    scope: "Indicative 10 kW hybrid inverter, approximately 11.16 kWp of PV modules (18 × 620 W), 16.07 kWh lithium storage, protections, mounting, installation, testing, and a remote-area transport allowance. Confirm roof/ground-mount, loads, and autonomy at survey.",
    total: 1_050_000,
    sourceLabel: "Kenyan supplier listing: 10 kW hybrid package with 11.16 kWp PV, 16.07 kWh battery, and installation listed at KSh 950,000 within its local service radius; KSh 100,000 is an illustrative remote-area allowance.",
    sourceUrl: "https://rhemasolarenergy.com/product/10kw-solis-hybrid-inverter-16-07-kwh-dyness-power-brick/",
    stages: [
      { percent: 30, label: "Load survey, design, and procurement deposit" },
      { percent: 50, label: "Equipment delivery, installation, and protections" },
      { percent: 20, label: "System testing, user training, and handover" },
    ],
  },
  {
    id: "borehole",
    name: "School borehole and storage",
    category: "Borehole Solutions",
    scope: "Budget assumption: 100 m borehole, survey/permits, casing and yield testing, pump upgraded to solar pumping, 10,000 L storage with tower and basic distribution, and a remote-area allowance. Depth, yield, water quality, tower design, and route must be verified before any firm offer.",
    total: 1_510_000,
    sourceLabel: "Kenyan drilling guide estimates a 100 m drilled, cased, tested borehole with pump from KSh 980,000; this model adds a provisional solar-pump uplift, storage/tower/distribution, and remote mobilisation allowance.",
    sourceUrl: "https://proboreholedrillers.co.ke/borehole-drilling-cost-in-kenya/",
    stages: [
      { percent: 30, label: "Hydrogeological survey, permits, and mobilisation" },
      { percent: 50, label: "Drilling, casing, yield test, and water analysis" },
      { percent: 20, label: "Solar pump, storage, commissioning, and handover" },
    ],
  },
] as const;

export type SchoolPaymentPlanId = (typeof schoolPaymentPlans)[number]["id"];

export function getSchoolPaymentPlan(id: string) {
  return schoolPaymentPlans.find((plan) => plan.id === id);
}

export function getPlanStageAmounts(total: number, percentages: readonly number[]) {
  const amounts: number[] = [];
  let assigned = 0;
  percentages.forEach((percent, index) => {
    const amount = index === percentages.length - 1 ? total - assigned : Math.round(total * percent) / 100;
    amounts.push(amount);
    assigned += amount;
  });
  return amounts;
}
