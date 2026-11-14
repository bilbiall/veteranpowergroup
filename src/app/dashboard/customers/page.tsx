import { prisma } from "@/lib/prisma";
import { createCustomer, deleteCustomer, mergeDuplicateCustomers } from "@/app/dashboard/actions";
import { requireSectionAccess } from "@/lib/prototype-auth";

function normalizeIdentity(value: string | null) {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export default async function CustomersPage({ searchParams }: PageProps<"/dashboard/customers">) {
  const params = await searchParams;
  await requireSectionAccess("customers");
  const customers = await prisma.customer.findMany({ orderBy: [{ name: "asc" }, { company: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, company: true, email: true, phone: true, createdAt: true, _count: { select: { documents: true, payments: true } } } });
  const identityGroups = new Map<string, typeof customers>();
  for (const customer of customers) {
    const key = JSON.stringify([normalizeIdentity(customer.name), normalizeIdentity(customer.company)]);
    identityGroups.set(key, [...(identityGroups.get(key) ?? []), customer]);
  }
  const duplicateGroups = new Map<string, typeof customers>();
  const primaryDuplicateIds = new Set<string>();
  for (const group of identityGroups.values()) {
    if (group.length < 2) continue;
    primaryDuplicateIds.add(group[0].id);
    for (const customer of group) duplicateGroups.set(customer.id, group);
  }
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Workspace</p><h1>Customers</h1><p className="dashboard-note">Fictional sample records for the prototype.</p></div><span className="prototype-badge">{customers.length} records</span></header>
    {params.created === "1" && <p className="notice" role="status">Customer added to the sample workspace.</p>}
    {params.deleted === "1" && <p className="notice" role="status">Customer deleted.</p>}
    {params.delete === "linked" && <p className="notice notice-error" role="alert">This customer has documents or payments. Merge the duplicate or resolve those records before deleting.</p>}
    {params.merged && <p className="notice" role="status">Merged {params.merged} duplicate customer record(s). Documents, payments, and media now use the retained customer.</p>}
    {params.merge === "not-duplicate" && <p className="notice notice-error" role="alert">No matching customer duplicates remain to merge.</p>}
    {params.merge === "missing" && <p className="notice notice-error" role="alert">That customer record no longer exists.</p>}
    {params.error === "invalid" && <p className="notice notice-error" role="alert">Check the customer name and email, then try again.</p>}
    {params.error === "setup" && <p className="notice notice-error" role="alert">Run the sample database seed before adding customers.</p>}
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Directory</p><h3>All customers</h3></div></div>
      {customers.length === 0 ? <p className="empty-state">No customers yet. Add a sample record below.</p> : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Documents</th><th>Actions</th></tr></thead><tbody>{customers.map((customer) => { const duplicates = duplicateGroups.get(customer.id); const deleteBlocked = customer._count.documents > 0 || customer._count.payments > 0; return <tr key={customer.id}><td>{customer.name}{duplicates && <small className="customer-duplicate-note"> · {duplicates.length} matching records</small>}</td><td>{customer.company ?? "—"}</td><td>{customer.email ?? "—"}</td><td>{customer.phone ?? "—"}</td><td>{customer._count.documents}</td><td className="customer-row-actions">{duplicates && primaryDuplicateIds.has(customer.id) && <form action={mergeDuplicateCustomers} data-single-submit data-confirm={`Merge ${duplicates.length} customers with the same name and company? Their documents, payments, and media will be combined under the oldest record.`}><input type="hidden" name="customerId" value={customer.id} /><button className="staff-action" type="submit">Merge {duplicates.length} duplicates</button></form>}<form action={deleteCustomer} data-single-submit data-confirm={`Delete customer ${customer.name}? This cannot be undone.`}><input type="hidden" name="customerId" value={customer.id} /><button className="table-delete-button" type="submit" disabled={deleteBlocked} title={deleteBlocked ? "Merge this customer or resolve its documents and payments before deleting." : `Delete customer ${customer.name}`} aria-label={`Delete customer ${customer.name}`}>Delete</button></form></td></tr>; })}</tbody></table></div>}
    </section>
    <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Prototype workflow</p><h3>Add a customer</h3></div></div><form action={createCustomer} className="prototype-form"><label>Name<input name="name" required minLength={2} maxLength={120} /></label><label>Company<input name="company" maxLength={120} /></label><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" maxLength={40} /></label><button className="dashboard-button" type="submit">Save sample customer</button></form></section>
  </main>;
}
