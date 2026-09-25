import { prisma } from "@/lib/prisma";
import { requirePrototypeSession } from "@/lib/prototype-auth";
import Link from "next/link";

export default async function InvoicesPage() {
  await requirePrototypeSession();
  const invoices = await prisma.document.findMany({ where: { type: "INVOICE" }, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true, company: true } } } });
  return <main className="dashboard-main"><header className="page-title"><div><p className="eyebrow">Finance</p><h1>Invoices</h1><p className="dashboard-note">Sample records only. Payment and tax rules are provisional.</p></div><span className="prototype-badge">{invoices.length} records</span></header><section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Billing</p><h3>All invoices</h3></div></div>{invoices.length === 0 ? <p className="empty-state">No sample invoices yet.</p> : <div className="table-scroll"><table><thead><tr><th>Number</th><th>Customer</th><th>Status</th><th>Total</th><th>Created</th><th /></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.number}</td><td>{invoice.customer.company || invoice.customer.name}</td><td>{invoice.invoiceStatus ?? "Draft"}</td><td>{invoice.total.toLocaleString("en", { maximumFractionDigits: 2 })}</td><td>{invoice.createdAt.toLocaleDateString("en")}</td><td><Link className="table-action" href={`/dashboard/documents/${invoice.id}`}>View &amp; download</Link></td></tr>)}</tbody></table></div>}</section></main>;
}
