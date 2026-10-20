import { createSchoolPlanQuotation } from "@/app/dashboard/actions";
import { SchoolPriceFields } from "@/app/dashboard/payment-plans/school-price-fields";
import { getPlanStageAmounts, schoolPaymentPlans } from "@/lib/school-payment-plans";
import { prisma } from "@/lib/prisma";
import { requirePrototypeSession } from "@/lib/prototype-auth";

const kes = (amount: number) => `KES ${amount.toLocaleString("en", { maximumFractionDigits: 2 })}`;

export default async function SchoolPaymentPlansPage({ searchParams }: PageProps<"/dashboard/payment-plans">) {
  await requirePrototypeSession();
  const params = await searchParams;
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" }, select: { name: true, company: true } });
  const suggestions = [...new Set(customers.map((customer) => customer.company || customer.name).filter(Boolean))];
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Finance · Staff only</p><h1>School payment templates</h1><p className="dashboard-note">Three-stage templates retain illustrative hardship-area budgets in Kenya shillings. Fill in institution details and edit the stage amounts for the school before issuing.</p></div><span className="prototype-badge">3 templates</span></header>
    {params.error === "invalid" && <p className="notice notice-error" role="alert">Enter a customer name, choose a currency, and provide all three stage amounts.</p>}
    {params.error === "logo" && <p className="notice notice-error" role="alert">We could not read that logo as an image. Choose a supported image file and try again.</p>}
    {params.error === "setup" && <p className="notice notice-error" role="alert">Company setup is incomplete. Run the sample database seed first.</p>}
    <p className="notice">Fillable templates start with the sample prices and three-stage percentages. Edit school details and stage amounts before creating a draft. Examples are indicative and ex-VAT. KRA’s general VAT rate is 16% for taxable supplies; confirm the applicable treatment. Receipts are generated only after staff record money actually received.</p>
    <section className="school-plan-grid" aria-label="Example three stage school payment plans">
      {schoolPaymentPlans.map((plan) => {
        const amounts = getPlanStageAmounts(plan.total, plan.stages.map((stage) => stage.percent));
        return <article className="panel school-plan-card" key={plan.id}>
          <p className="eyebrow">{plan.category}</p><h2>{plan.name}</h2><p className="dashboard-note">{plan.scope}</p>
          <p className="school-plan-total">{kes(plan.total)} <span>indicative, ex-VAT</span></p>
          <ol className="school-plan-stages">{plan.stages.map((stage, index) => <li key={stage.label}><span><b>Stage {index + 1} · {stage.percent}%</b><small>{stage.label}</small></span><strong>{kes(amounts[index])}</strong></li>)}</ol>
          <p className="table-subtext">Price basis: <a className="inline-link" href={plan.sourceUrl} target="_blank" rel="noreferrer">{plan.sourceLabel}</a></p>
          <form action={createSchoolPlanQuotation} className="school-plan-form">
            <input type="hidden" name="planId" value={plan.id} />
            <p className="school-template-label">Fill in the institution and payment schedule</p>
            <label>Customer / institution name<input name="customerName" list={`customer-suggestions-${plan.id}`} autoComplete="organization" required minLength={2} maxLength={160} placeholder="Start typing an existing customer or enter a new name" /><datalist id={`customer-suggestions-${plan.id}`}>{suggestions.map((name) => <option key={name} value={name} />)}</datalist><small>Existing customer names will be suggested; you can type a new one.</small></label>
            <label>Contact person (optional)<input name="contactName" autoComplete="name" maxLength={120} placeholder="Name for the quotation" /></label>
            <label>Email (optional)<input name="email" type="email" autoComplete="email" /></label>
            <label>Phone (optional)<input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
            <label>School location / address<input name="address" autoComplete="street-address" maxLength={240} placeholder="County, town, and site" /></label>
            <label className="school-logo-upload">Institution logo (optional)<input name="institutionLogo" type="file" /><small>Common image formats are supported, including SVG, GIF, WebP, TIFF, AVIF, and HEIF. Large logos are optimized automatically and added to the quotation, invoices, and receipts.</small></label>
            <SchoolPriceFields stages={plan.stages} sampleAmounts={amounts} />
            <button className="dashboard-button" type="submit">Create draft quotation</button>
          </form>
        </article>;
      })}
    </section>
  </main>;
}
