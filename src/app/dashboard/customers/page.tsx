import { prisma } from "@/lib/prisma";
import { createCustomer } from "@/app/dashboard/actions";
import { requirePrototypeSession } from "@/lib/prototype-auth";

export default async function CustomersPage({ searchParams }: PageProps<"/dashboard/customers">) {
  const params = await searchParams;
  await requirePrototypeSession();
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true, email: true, phone: true, _count: { select: { documents: true } } } });
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Workspace</p><h1>Customers</h1><p className="dashboard-note">Fictional sample records for the prototype.</p></div><span className="prototype-badge">{customers.length} records</span></header>
    {params.created === "1" && <p className="notice" role="status">Customer added to the sample workspace.</p>}
    {params.error === "invalid" && <p className="notice notice-error" role="alert">Check the customer name and email, then try again.</p>}
    {params.error === "setup" && <p className="notice notice-error" role="alert">Run the sample database seed before adding customers.</p>}
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Directory</p><h3>All customers</h3></div></div>
      {customers.length === 0 ? <p className="empty-state">No customers yet. Add a sample record below.</p> : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Documents</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td>{customer.name}</td><td>{customer.company ?? "—"}</td><td>{customer.email ?? "—"}</td><td>{customer.phone ?? "—"}</td><td>{customer._count.documents}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Prototype workflow</p><h3>Add a customer</h3></div></div><form action={createCustomer} className="prototype-form"><label>Name<input name="name" required minLength={2} maxLength={120} /></label><label>Company<input name="company" maxLength={120} /></label><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" maxLength={40} /></label><button className="dashboard-button" type="submit">Save sample customer</button></form></section>
  </main>;
}
