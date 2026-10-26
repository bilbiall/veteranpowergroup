"use client";

import { createQuotation } from "@/app/dashboard/actions";
import CustomerSelect, { type CustomerOption } from "@/components/customer-select";

export default function QuotationForm({ customers }: { customers: CustomerOption[] }) {
  return <form action={createQuotation} className="prototype-form">
    <CustomerSelect customers={customers} />
    <label>Description<input name="description" required minLength={2} maxLength={250} /></label>
    <label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>
    <label>Unit price<input name="unitPrice" type="number" min="0" step="0.01" defaultValue="0" required /></label>
    <button className="dashboard-button" type="submit">Create draft</button>
  </form>;
}
