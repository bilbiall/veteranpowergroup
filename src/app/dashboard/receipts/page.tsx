import { prisma } from "@/lib/prisma";
import { requirePrototypeSession } from "@/lib/prototype-auth";
import Link from "next/link";

export default async function ReceiptsPage() {
  await requirePrototypeSession();
  const receipts = await prisma.document.findMany({ where: { type: "RECEIPT" }, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true, company: true } }, sourceDocument: { select: { number: true } } } });
  return <main className="dashboard-main"><header className="page-title"><div><p className="eyebrow">Finance</p><h1>Receipts</h1><p className="dashboard-note">Sample records only. No payment processor is connected.</p></div><span className="prototype-badge">{receipts.length} records</span></header><section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Payments</p><h3>All receipts</h3></div></div>{receipts.length === 0 ? <p className="empty-state">No sample receipts yet.</p> : <div className="table-scroll"><table><thead><tr><th>Number</th><th>Customer</th><th>Related invoice</th><th>Status</th><th>Total</th><th>Created</th><th /></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td>{receipt.number}</td><td>{receipt.customer.company || receipt.customer.name}</td><td>{receipt.sourceDocument?.number ?? "—"}</td><td>{receipt.receiptStatus ?? "Draft"}</td><td>{receipt.total.toLocaleString("en", { maximumFractionDigits: 2 })}</td><td>{receipt.createdAt.toLocaleDateString("en")}</td><td><Link className="table-action" href={`/dashboard/documents/${receipt.id}`}>View &amp; download</Link></td></tr>)}</tbody></table></div>}</section></main>;
}
