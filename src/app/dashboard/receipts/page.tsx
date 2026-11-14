import { prisma } from "@/lib/prisma";
import { createReceipt, deleteDocumentRecord } from "@/app/dashboard/actions";
import { requireSectionAccess } from "@/lib/prototype-auth";
import Link from "next/link";
import { formatDocumentCurrency } from "@/lib/document-export-data";
import CustomerSelectEnhancer from "@/components/customer-select-enhancer";
import LineItemEditor from "@/components/line-item-editor";
import DocumentBulkDeleteToolbar from "@/components/document-bulk-delete-toolbar";

export default async function ReceiptsPage({ searchParams }: PageProps<"/dashboard/receipts">) {
  const params = await searchParams;
  await requireSectionAccess("receipts");
  const [customers, sources, receipts] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
    prisma.document.findMany({ where: { type: "INVOICE" }, orderBy: { createdAt: "desc" }, include: { payments: { select: { amount: true } } } }),
    prisma.document.findMany({ where: { type: "RECEIPT" }, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true, company: true } }, sourceDocument: { select: { id: true, number: true, type: true } }, etims: { select: { id: true } } } }),
  ]);
  const availableSources = sources.filter((source) => ["ISSUED", "PARTIALLY_PAID"].includes(source.invoiceStatus ?? "")
    && source.total - source.payments.reduce((sum, payment) => sum + payment.amount, 0) > 0.005);
  const selectedSource = availableSources.find((source) => source.id === params.sourceDocumentId);
  const sourceCustomerIds = Object.fromEntries(availableSources.map((source) => [source.id, source.customerId]));
  const requestedSourceUnavailable = Boolean(params.sourceDocumentId && !selectedSource);
  const formId = "receipt-bulk-delete-form";
  const selectableCount = receipts.filter((receipt) => !receipt.etims.length).length;
  const received = selectedSource?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
  const remaining = selectedSource ? Math.max(0, selectedSource.total - received) : 0;
  return <main className="dashboard-main"><CustomerSelectEnhancer formSelector={'form:has(select[name="sourceDocumentId"])'} sourceCustomerIds={sourceCustomerIds} /><header className="page-title"><div><p className="eyebrow">Finance</p><h1>Receipts</h1><p className="dashboard-note">Create receipts for invoice payments, or record a standalone receipt.</p></div><span className="prototype-badge">{receipts.length} records</span></header>
    {params.error === "invalid" && <p className="notice notice-error" role="alert">Check the customer, amount, description, payment method, and reference.</p>}
    {params.error === "setup" && <p className="notice notice-error" role="alert">Receipt creation is unavailable until the staff account and company settings are configured.</p>}
    {params.error === "source" && <p className="notice notice-error" role="alert">Choose an invoice or quotation that can be used to create a receipt.</p>}
    {params.error === "customer" && <p className="notice notice-error" role="alert">Choose a customer that still exists.</p>}
    {params.error === "invoice-state" && <p className="notice notice-error" role="alert">Only issued invoices with an outstanding balance can receive a receipt.</p>}
    {params.error === "balance" && <p className="notice notice-error" role="alert">The receipt amount exceeds the remaining balance.</p>}
    {params.deleted === "1" && <p className="notice" role="status">Receipt deleted. Any linked invoice balance has been recalculated.</p>}
    {params.bulk === "deleted" && <p className="notice" role="status">Deleted {params.count ?? 0} receipt(s). {Number(params.blocked) > 0 && `Skipped ${params.blocked} selected record(s) that could not be deleted.`} Linked invoice balances were recalculated.</p>}
    {params.bulk === "none" && <p className="notice notice-error" role="alert">Select at least one receipt to delete.</p>}
    {requestedSourceUnavailable && <p className="notice notice-error" role="alert">That invoice or quotation is no longer eligible for a receipt. Return to Receipts to create a standalone receipt if needed.</p>}
    <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">New receipt</p><h3>{selectedSource ? `Receipt for invoice ${selectedSource.number}` : "Standalone or linked receipt"}</h3></div></div>
      {requestedSourceUnavailable ? <p className="empty-state"><Link className="inline-link" href="/dashboard/receipts">Open a new standalone receipt form</Link></p> : <form action={createReceipt} className="prototype-form" data-single-submit><label>Related invoice (optional)<select name="sourceDocumentId" defaultValue={selectedSource?.id ?? ""}><option value="">Standalone receipt</option>{availableSources.map((source) => <option key={source.id} value={source.id}>Invoice {source.number}</option>)}</select></label><label>Customer (for standalone receipts)<select name="customerId" required defaultValue={selectedSource?.customerId ?? ""}><option value="" disabled>Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company ? `${customer.company} · ${customer.name}` : customer.name}</option>)}</select></label><label>Currency<select name="currency" defaultValue={selectedSource?.currency ?? "KES"}><option value="KES">KES</option><option value="USD">USD</option></select></label><label>Payment method<select name="method" required defaultValue="MOBILE_MONEY"><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="CARD">Card</option></select></label><label>Reference (optional)<input name="reference" maxLength={120} /></label><div className="line-item-full-width"><LineItemEditor prefix="receipt" currency={selectedSource?.currency ?? "KES"} initialRows={[{ description: selectedSource ? `Payment received for invoice ${selectedSource.number}` : "Payment received", quantity: "1", unitPrice: selectedSource ? remaining.toFixed(2) : "0", discount: "0", taxRate: "0" }]} /></div><button className="dashboard-button" type="submit">Create receipt</button></form>}
    </section>
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Payments</p><h3>All receipts</h3></div></div>{receipts.length === 0 ? <p className="empty-state">No receipts yet.</p> : <div className="table-scroll"><table><thead><tr><th><DocumentBulkDeleteToolbar formId={formId} type="RECEIPT" label="receipts" selectableCount={selectableCount} /></th><th>Number</th><th>Customer</th><th>Related document</th><th>Status</th><th>Total</th><th>Created</th><th>Actions</th><th>Delete</th></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td><input type="checkbox" name="documentIds" form={formId} value={receipt.id} disabled={receipt.etims.length > 0} aria-label={`Select receipt ${receipt.number}`} /></td><td>{receipt.number}</td><td>{receipt.customer.name}{receipt.customer.company && ` · ${receipt.customer.company}`}</td><td>{receipt.sourceDocument ? <Link className="table-action" href={`/dashboard/documents/${receipt.sourceDocument.id}`}>{receipt.sourceDocument.type} {receipt.sourceDocument.number}</Link> : "Standalone"}</td><td>{receipt.receiptStatus ?? "Draft"}</td><td>{formatDocumentCurrency(receipt.total, receipt.currency)}</td><td>{receipt.createdAt.toLocaleDateString("en")}</td><td><Link className="table-action" href={`/dashboard/documents/${receipt.id}`}>View, edit &amp; download</Link></td><td><form action={deleteDocumentRecord} data-single-submit data-confirm={`Delete receipt ${receipt.number}? This cannot be undone.`}><input type="hidden" name="documentId" value={receipt.id} /><button className="table-delete-button" type="submit" disabled={receipt.etims.length > 0} title={receipt.etims.length > 0 ? "Resolve eTIMS records before deleting." : `Delete receipt ${receipt.number}`} aria-label={`Delete receipt ${receipt.number}`}>Delete</button></form></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
