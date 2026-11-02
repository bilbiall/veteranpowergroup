import { prisma } from "@/lib/prisma";
import { createReceipt } from "@/app/dashboard/actions";
import { requireSectionAccess } from "@/lib/prototype-auth";
import Link from "next/link";
import { formatDocumentCurrency } from "@/lib/document-export-data";
import CustomerSelectEnhancer from "@/components/customer-select-enhancer";

export default async function ReceiptsPage({ searchParams }: PageProps<"/dashboard/receipts">) {
  const params = await searchParams;
  await requireSectionAccess("receipts");
  const [customers, sources, receipts] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
    prisma.document.findMany({ where: { type: { in: ["INVOICE", "QUOTATION"] } }, orderBy: { createdAt: "desc" }, include: { payments: { select: { amount: true } }, derivedDocuments: { where: { type: "INVOICE" }, select: { id: true } } } }),
    prisma.document.findMany({ where: { type: "RECEIPT" }, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true, company: true } }, sourceDocument: { select: { id: true, number: true, type: true } } } }),
  ]);
  const availableSources = sources.filter((source) => source.type === "INVOICE"
    ? ["ISSUED", "PARTIALLY_PAID"].includes(source.invoiceStatus ?? "") && source.total - source.payments.reduce((sum, payment) => sum + payment.amount, 0) > 0.005
    : source.derivedDocuments.length === 0 && source.total - source.payments.reduce((sum, payment) => sum + payment.amount, 0) > 0.005);
  const selectedSource = availableSources.find((source) => source.id === params.sourceDocumentId);
  const sourceCustomerIds = Object.fromEntries(availableSources.map((source) => [source.id, source.customerId]));
  const requestedSourceUnavailable = Boolean(params.sourceDocumentId && !selectedSource);
  const received = selectedSource?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
  const remaining = selectedSource ? Math.max(0, selectedSource.total - received) : 0;
  return <main className="dashboard-main"><CustomerSelectEnhancer formSelector={'form:has(select[name="sourceDocumentId"])'} sourceCustomerIds={sourceCustomerIds} /><header className="page-title"><div><p className="eyebrow">Finance</p><h1>Receipts</h1><p className="dashboard-note">Create receipts from invoice or quotation payments, or record a standalone receipt.</p></div><span className="prototype-badge">{receipts.length} records</span></header>
    {params.error === "invalid" && <p className="notice notice-error" role="alert">Check the customer, amount, description, payment method, and reference.</p>}
    {params.error === "setup" && <p className="notice notice-error" role="alert">Receipt creation is unavailable until the staff account and company settings are configured.</p>}
    {params.error === "source" && <p className="notice notice-error" role="alert">Choose an invoice or quotation that can be used to create a receipt.</p>}
    {params.error === "customer" && <p className="notice notice-error" role="alert">Choose a customer that still exists.</p>}
    {params.error === "invoice-state" && <p className="notice notice-error" role="alert">Only issued invoices with an outstanding balance can receive a receipt.</p>}
    {params.error === "quotation-invoiced" && <p className="notice notice-error" role="alert">This quotation already has linked invoices. Create receipts from the invoice that received payment.</p>}
    {params.error === "balance" && <p className="notice notice-error" role="alert">The receipt amount exceeds the remaining balance.</p>}
    {requestedSourceUnavailable && <p className="notice notice-error" role="alert">That invoice or quotation is no longer eligible for a receipt. Return to Receipts to create a standalone receipt if needed.</p>}
    <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">New receipt</p><h3>{selectedSource ? `Receipt for ${selectedSource.type.toLowerCase()} ${selectedSource.number}` : "Standalone or linked receipt"}</h3></div></div>
      {requestedSourceUnavailable ? <p className="empty-state"><Link className="inline-link" href="/dashboard/receipts">Open a new standalone receipt form</Link></p> : customers.length === 0 ? <p className="empty-state">Add a customer before creating a receipt.</p> : <form action={createReceipt} className="prototype-form"><label>Related invoice or quotation (optional)<select name="sourceDocumentId" defaultValue={selectedSource?.id ?? ""}><option value="">Standalone receipt</option>{availableSources.map((source) => <option key={source.id} value={source.id}>{source.type} {source.number}</option>)}</select></label><label>Customer (for standalone receipts)<select name="customerId" required defaultValue={selectedSource?.customerId ?? ""}><option value="" disabled>Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company ? `${customer.company} · ${customer.name}` : customer.name}</option>)}</select></label><label>Currency<select name="currency" defaultValue={selectedSource?.currency ?? "KES"}><option value="KES">KES</option><option value="USD">USD</option></select></label><label>Amount received<input name="amount" type="number" min="0.01" max={selectedSource ? remaining : undefined} step="0.01" defaultValue={selectedSource ? remaining.toFixed(2) : ""} required /></label><label>Receipt description<input name="description" minLength={2} maxLength={250} defaultValue={selectedSource ? `Payment received for ${selectedSource.type.toLowerCase()} ${selectedSource.number}` : "Payment received"} required /></label><label>Payment method<select name="method" required defaultValue="MOBILE_MONEY"><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="CARD">Card</option></select></label><label>Reference (optional)<input name="reference" maxLength={120} /></label><button className="dashboard-button" type="submit">Create receipt</button></form>}
    </section>
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Payments</p><h3>All receipts</h3></div></div>{receipts.length === 0 ? <p className="empty-state">No receipts yet.</p> : <div className="table-scroll"><table><thead><tr><th>Number</th><th>Customer</th><th>Related document</th><th>Status</th><th>Total</th><th>Created</th><th /></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td>{receipt.number}</td><td>{receipt.customer.company || receipt.customer.name}</td><td>{receipt.sourceDocument ? <Link className="table-action" href={`/dashboard/documents/${receipt.sourceDocument.id}`}>{receipt.sourceDocument.type} {receipt.sourceDocument.number}</Link> : "Standalone"}</td><td>{receipt.receiptStatus ?? "Draft"}</td><td>{formatDocumentCurrency(receipt.total, receipt.currency)}</td><td>{receipt.createdAt.toLocaleDateString("en")}</td><td><Link className="table-action" href={`/dashboard/documents/${receipt.id}`}>View, edit &amp; download</Link></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
