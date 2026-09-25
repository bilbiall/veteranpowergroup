import { prisma } from "@/lib/prisma";
import { createQuotation } from "@/app/dashboard/actions";
import { requirePrototypeSession } from "@/lib/prototype-auth";
import Link from "next/link";

export default async function QuotationsPage({ searchParams }: PageProps<"/dashboard/quotations">) {
  const params = await searchParams;
  await requirePrototypeSession();
  const [customers, quotations] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
    prisma.document.findMany({ where: { type: "QUOTATION" }, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true, company: true } }, _count: { select: { items: true } } } }),
  ]);
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Finance</p><h1>Quotations</h1><p className="dashboard-note">Drafts use provisional numbering, tax, and currency rules.</p></div><span className="prototype-badge">{quotations.length} records</span></header>
    {params.created === "1" && <p className="notice" role="status">Draft quotation created.</p>}
    {params.error === "invalid" && <p className="notice notice-error" role="alert">Check the customer, description, quantity, and amount.</p>}
    {params.error === "customer" && <p className="notice notice-error" role="alert">Choose a customer that still exists.</p>}
    {params.error === "setup" && <p className="notice notice-error" role="alert">Run the sample database seed before creating quotations.</p>}
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Draft workspace</p><h3>All quotations</h3></div></div>
      {quotations.length === 0 ? <p className="empty-state">No quotations yet. Create a draft below.</p> : <div className="table-scroll"><table><thead><tr><th>Number</th><th>Customer</th><th>Status</th><th>Items</th><th>Total</th><th>Created</th><th /></tr></thead><tbody>{quotations.map((quote) => <tr key={quote.id}><td>{quote.number}</td><td>{quote.customer.company || quote.customer.name}</td><td>{quote.quotationStatus ?? "Draft"}</td><td>{quote._count.items}</td><td>{quote.total.toLocaleString("en", { maximumFractionDigits: 2 })}</td><td>{quote.createdAt.toLocaleDateString("en")}</td><td><Link className="table-action" href={`/dashboard/documents/${quote.id}`}>View &amp; download</Link></td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Prototype workflow</p><h3>New draft quotation</h3></div></div>
      {customers.length === 0 ? <p className="empty-state">Add a customer first in the <a className="inline-link" href="/dashboard/customers">customer directory</a>.</p> : <form action={createQuotation} className="prototype-form"><label>Customer<select name="customerId" required defaultValue=""><option value="" disabled>Select a sample customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company ? `${customer.company} · ${customer.name}` : customer.name}</option>)}</select></label><label>Description<input name="description" required minLength={2} maxLength={250} /></label><label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required /></label><label>Unit price<input name="unitPrice" type="number" min="0" step="0.01" defaultValue="0" required /></label><button className="dashboard-button" type="submit">Create draft</button></form>}
    </section>
  </main>;
}
