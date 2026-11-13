import { prisma } from "@/lib/prisma";
import { requireSectionAccess } from "@/lib/prototype-auth";
import Link from "next/link";
import { formatDocumentCurrency } from "@/lib/document-export-data";
import InvoiceForm from "./invoice-form";

export default async function InvoicesPage({ searchParams }: PageProps<"/dashboard/invoices">) {
  const params = await searchParams;
  await requireSectionAccess("invoices");
  const [invoices, customers, documentSettings] = await Promise.all([
    prisma.document.findMany({ where: { type: "INVOICE" }, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true, company: true } }, sourceDocument: { select: { id: true, number: true } }, payments: { select: { amount: true } } } }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
    prisma.documentSettings.findUnique({ where: { companyId: 1 }, select: { defaultTaxRate: true } }),
  ]);
  return <main className="dashboard-main"><header className="page-title"><div><p className="eyebrow">Finance</p><h1>Invoices</h1><p className="dashboard-note">Review invoice status and follow links back to each quotation. Create receipts for issued invoices as payments are received.</p></div><div className="invoice-page-actions"><Link className="dashboard-button" href="/dashboard/quotations">Generate from quotation ↗</Link><span className="prototype-badge">{invoices.length} records</span></div></header>
    {params.created === "1" && <p className="notice" role="status">Draft invoice created.</p>}
    {params.deleted === "1" && <p className="notice" role="status">Invoice deleted.</p>}
    {params.error === "invalid" && <p className="notice notice-error" role="alert">Check the customer, terms, and line item values. Discounts cannot exceed the line amount.</p>}
    {params.error === "customer" && <p className="notice notice-error" role="alert">Choose a customer that still exists.</p>}
    {params.error === "setup" && <p className="notice notice-error" role="alert">Invoice creation is unavailable until the staff account and company settings are configured.</p>}
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Billing</p><h3>All invoices</h3></div></div>{invoices.length === 0 ? <p className="empty-state">No invoices yet. Create a standalone draft below or generate invoices from a quotation.</p> : <div className="table-scroll"><table><thead><tr><th>Number</th><th>Customer</th><th>Quotation</th><th>Status</th><th>Paid</th><th>Total</th><th>Created</th><th /></tr></thead><tbody>{invoices.map((invoice) => { const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0); const canCreateReceipt = ["ISSUED", "PARTIALLY_PAID"].includes(invoice.invoiceStatus ?? "") && invoice.total - paid > 0.005; return <tr key={invoice.id}><td>{invoice.number}</td><td>{invoice.customer.name}{invoice.customer.company && ` · ${invoice.customer.company}`}</td><td>{invoice.sourceDocument ? <Link className="table-action" href={`/dashboard/documents/${invoice.sourceDocument.id}`}>{invoice.sourceDocument.number}</Link> : "—"}</td><td>{invoice.invoiceStatus ?? "Draft"}</td><td>{formatDocumentCurrency(paid, invoice.currency)}</td><td>{formatDocumentCurrency(invoice.total, invoice.currency)}</td><td>{invoice.createdAt.toLocaleDateString("en")}</td><td><Link className="table-action" href={`/dashboard/documents/${invoice.id}`}>View, edit &amp; download</Link>{canCreateReceipt && <> · <Link className="table-action" href={`/dashboard/receipts?sourceDocumentId=${invoice.id}`}>Create receipt</Link></>}</td></tr>; })}</tbody></table></div>}</section>
    <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Standalone invoice</p><h3>New draft invoice</h3><p className="dashboard-note">Not linked to a quotation. Add customer, terms, and line items; create invoices from a quotation to preserve the document chain.</p></div></div><InvoiceForm customers={customers} defaultTaxRate={documentSettings?.defaultTaxRate ?? 0} /></section>
  </main>;
}
