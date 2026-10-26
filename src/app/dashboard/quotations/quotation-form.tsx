"use client";

import { useState } from "react";
import { createQuotation } from "@/app/dashboard/actions";

type CustomerOption = { id: string; name: string; company: string | null };

export default function QuotationForm({ customers }: { customers: CustomerOption[] }) {
  const [addingCustomer, setAddingCustomer] = useState(false);

  return <form action={createQuotation} className="prototype-form">
    <label>Customer<select name="customerId" required defaultValue="" onChange={(event) => setAddingCustomer(event.target.value === "__new__")}>
      <option value="" disabled>Select a customer</option>
      {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company ? `${customer.company} · ${customer.name}` : customer.name}</option>)}
      <option value="__new__">+ Add a new customer</option>
    </select></label>
    {addingCustomer && <>
      <label>Customer name<input name="newCustomerName" required minLength={2} maxLength={120} /></label>
      <label>Company<input name="newCustomerCompany" maxLength={120} /></label>
      <label>Email<input name="newCustomerEmail" type="email" /></label>
      <label>Phone<input name="newCustomerPhone" maxLength={40} /></label>
    </>}
    <label>Description<input name="description" required minLength={2} maxLength={250} /></label>
    <label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>
    <label>Unit price<input name="unitPrice" type="number" min="0" step="0.01" defaultValue="0" required /></label>
    <button className="dashboard-button" type="submit">Create draft</button>
  </form>;
}
