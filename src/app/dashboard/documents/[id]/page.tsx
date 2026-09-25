import Link from "next/link";
import { notFound } from "next/navigation";
import { documentStatus, documentTypeLabel, findExportDocument, formatDocumentNumber } from "@/lib/document-export-data";
import { requirePrototypeSession } from "@/lib/prototype-auth";

export default async function DocumentDetailPage({ params }: PageProps<"/dashboard/documents/[id]">) {
  await requirePrototypeSession();
  const { id } = await params;
  const document = await findExportDocument(id);
  if (!document) notFound();

  const exportUrl = (format: string) => `/api/documents/${document.id}/export?format=${format}`;
  const company = document.company.profile;
  return <main className="dashboard-main">
    <p className="document-back"><Link href={`/dashboard/${document.type.toLowerCase()}s`}>← Back to {documentTypeLabel(document.type).toLowerCase()}s</Link></p>
    <header className="document-detail-heading"><div><p className="eyebrow">{documentTypeLabel(document.type)} · {documentStatus(document)}</p><h1>{document.number}</h1><p className="dashboard-note">Created {document.createdAt.toLocaleDateString("en")} · Prototype document</p></div><span className="prototype-badge">Saved record</span></header>
    <section className="panel export-panel"><div><p className="eyebrow">Download this document</p><h2>Choose a format</h2><p className="dashboard-note">Files include the saved company details, customer, line items, and totals.</p></div><div className="export-actions"><a className="export-button" href={exportUrl("docx")} download>Word <span>.docx</span></a><a className="export-button" href={exportUrl("xlsx")} download>Excel <span>.xlsx</span></a><a className="export-button" href={exportUrl("pdf")} download>PDF <span>.pdf</span></a></div></section>
    <section className="document-preview">
      <header className="preview-company"><div><p className="eyebrow">{company?.name ?? "Company details to be confirmed"}</p>{company?.address && <p>{company.address}</p>}<p>{[company?.email, company?.phone].filter(Boolean).join(" · ")}</p>{company?.taxInformation && <p>Tax information: {company.taxInformation}</p>}</div><div className="preview-type"><span>{documentTypeLabel(document.type)}</span><strong>{document.number}</strong><small>{documentStatus(document)}</small></div></header>
      <section className="preview-customer"><p className="eyebrow">Bill to</p><strong>{document.customer.company || document.customer.name}</strong>{document.customer.company && <span>{document.customer.name}</span>}{document.customer.address && <span>{document.customer.address}</span>}{document.customer.email && <span>{document.customer.email}</span>}{document.customer.phone && <span>{document.customer.phone}</span>}{document.sourceDocument && <span>Related invoice: {document.sourceDocument.number}</span>}</section>
      <div className="table-scroll"><table className="preview-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead><tbody>{document.items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{formatDocumentNumber(item.quantity)}</td><td>{formatDocumentNumber(item.unitPrice)}</td><td>{formatDocumentNumber(item.discount)}</td><td>{formatDocumentNumber(item.taxAmount)}</td><td>{formatDocumentNumber(item.total)}</td></tr>)}</tbody></table></div>
      <dl className="document-totals"><div><dt>Subtotal</dt><dd>{formatDocumentNumber(document.subtotal)}</dd></div><div><dt>Tax</dt><dd>{formatDocumentNumber(document.tax)}</dd></div><div className="document-total"><dt>Total</dt><dd>{formatDocumentNumber(document.total)}</dd></div></dl>
      {document.payment && <p className="dashboard-note">Paid {formatDocumentNumber(document.payment.amount)} via {document.payment.method.replaceAll("_", " ")} on {document.payment.paidAt.toLocaleDateString("en")}.</p>}
      {document.company.documents?.terms && <section className="preview-terms"><h2>Terms</h2><p>{document.company.documents.terms}</p></section>}
      <p className="preview-disclaimer">Generated from the Northstar prototype. Confirm company, tax, currency, and legal details before external use.</p>
    </section>
  </main>;
}
