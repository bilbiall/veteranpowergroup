"use client";

import { createStandaloneInvoice } from "@/app/dashboard/actions";
import CustomerSelect, { type CustomerOption } from "@/components/customer-select";
import LineItemEditor from "@/components/line-item-editor";

export default function InvoiceForm({ customers, defaultTaxRate }: { customers: CustomerOption[]; defaultTaxRate: number }) {
  return <form action={createStandaloneInvoice} className="prototype-form" data-single-submit>
    <CustomerSelect customers={customers} />
    <label className="line-item-full-width">Terms<textarea name="terms" maxLength={8000} rows={4} placeholder="Enter payment, delivery, or validity terms" /></label>
    <div className="line-item-full-width"><LineItemEditor currency="KES" defaultTaxRate={defaultTaxRate} /></div>
    <p className="dashboard-note line-item-full-width">New invoices use KES. Review the customer, terms, and line items before saving.</p>
    <button className="dashboard-button" type="submit">Create draft invoice</button>
  </form>;
}
