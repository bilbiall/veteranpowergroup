import { prisma } from "@/lib/prisma";
import { requirePrototypeSession } from "@/lib/prototype-auth";

export default async function SettingsPage() {
  await requirePrototypeSession();
  const company = await prisma.companySettings.findUnique({ where: { id: 1 }, include: { profile: true, documents: true, websiteAppearance: true } });
  return <main className="dashboard-main"><header className="page-title"><div><p className="eyebrow">Manage</p><h1>Prototype settings</h1><p className="dashboard-note">These defaults are placeholders until the company requirements arrive.</p></div><span className="prototype-badge">Provisional</span></header><section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Company profile</p><h3>{company?.profile?.name ?? "Not configured"}</h3></div></div><dl className="settings-list"><div><dt>Address</dt><dd>{company?.profile?.address ?? "Not configured"}</dd></div><div><dt>Email</dt><dd>{company?.profile?.email ?? "Not configured"}</dd></div><div><dt>Quotation prefix</dt><dd>{company?.documents?.quotePrefix ?? "Not configured"}</dd></div><div><dt>Default tax rate</dt><dd>{company?.documents?.defaultTaxRate ?? 0}%</dd></div><div><dt>Quotation validity</dt><dd>{company?.documents?.quoteValidityDays ?? "Not configured"} days</dd></div><div><dt>Currency</dt><dd>Awaiting requirements</dd></div></dl></section></main>;
}
