"use client";

import { createQuotation } from "@/app/dashboard/actions";
import CustomerSelect, { type CustomerOption } from "@/components/customer-select";
import LineItemEditor from "@/components/line-item-editor";
import { QUOTATION_INVOICE_TERMS } from "@/lib/document-terms";

export default function QuotationForm({ customers, defaultTaxRate }: { customers: CustomerOption[]; defaultTaxRate: number }) {
  return <form action={createQuotation} className="prototype-form" data-single-submit>
    <CustomerSelect customers={customers} />
    <label className="line-item-full-width">Terms<textarea name="terms" maxLength={8000} rows={4} defaultValue={QUOTATION_INVOICE_TERMS} /></label>
    <div className="line-item-full-width"><LineItemEditor defaultTaxRate={defaultTaxRate} /></div>
    <button className="dashboard-button" type="submit">Create quotation</button>
  </form>;
}
