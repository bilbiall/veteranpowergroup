import { prisma } from "@/lib/prisma";
import { requirePrototypeSession } from "@/lib/prototype-auth";
import { formatDocumentCurrency } from "@/lib/document-export-data";
import QuotationForm from "./quotation-form";
import Link from "next/link";

export default async function QuotationsPage({ searchParams }: PageProps<"/dashboard/quotations">) {
  const params = await searchParams;
  await requirePrototypeSession();
  const [customers, quotations] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
    prisma.document.findMany({ where: { type: "QUOTATION" }, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true, company: true } }, _count: { select: { items: true } }, payments: { select: { amount: true } }, derivedDocuments: { where: { type: "INVOICE" }, select: { id: true } } } }),
  ]);
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Finance</p><h1>Quotations</h1><p className="dashboard-note">Drafts use provisional numbering, tax, and currency rules.</p></div><span className="prototype-badge">{quotations.length} records</span></header>
    {params.created === "1" && <p className="notice" role="status">Draft quotation created.</p>}
    {params.error === "invalid" && <p className="notice notice-error" role="alert">Check the customer, description, quantity, and amount.</p>}
    {params.error === "customer" && <p className="notice notice-error" role="alert">Choose a customer that still exists.</p>}
    {params.error === "setup" && <p className="notice notice-error" role="alert">Run the sample database seed before creating quotations.</p>}
    {params.invoices === "payments" && <p className="notice notice-error" role="alert">This quotation has receipts recorded against it. Create invoices only after resolving those receipts.</p>}
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Draft workspace</p><h3>All quotations</h3></div></div>
      {quotations.length === 0 ? <p className="empty-state">No quotations yet. Create a draft below.</p> : <div className="table-scroll"><table><thead><tr><th>Number</th><th>Customer</th><th>Status</th><th>Items</th><th>Linked invoices</th><th>Total</th><th>Created</th><th /></tr></thead><tbody>{quotations.map((quote) => { const received = quote.payments.reduce((sum, payment) => sum + payment.amount, 0); const canCreateReceipt = quote.derivedDocuments.length === 0 && quote.total - received > 0.005; return <tr key={quote.id}><td>{quote.number}</td><td>{quote.customer.company || quote.customer.name}</td><td>{quote.quotationStatus ?? "Draft"}</td><td>{quote._count.items}</td><td>{quote.derivedDocuments.length}</td><td>{formatDocumentCurrency(quote.total, quote.currency)}</td><td>{quote.createdAt.toLocaleDateString("en")}</td><td><Link className="table-action" href={`/dashboard/documents/${quote.id}`}>View, edit &amp; download</Link>{canCreateReceipt && <> · <Link className="table-action" href={`/dashboard/receipts?sourceDocumentId=${quote.id}`}>Create receipt</Link></>}</td></tr>; })}</tbody></table></div>}
    </section>
    <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Prototype workflow</p><h3>New draft quotation</h3></div></div>
      <QuotationForm customers={customers} />
    </section>
  </main>;
}
