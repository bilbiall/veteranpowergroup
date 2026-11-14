import { updateReceiptDetails } from "@/app/dashboard/actions";

type Props = {
  documentId: string;
  currency: string;
  customerId: string;
  customers: { id: string; name: string; company: string | null }[];
  terms: string;
  amount: number;
  method: "CASH" | "CARD" | "BANK_TRANSFER" | "MOBILE_MONEY";
  reference: string | null;
  description: string;
  linked: boolean;
};

export default function ReceiptDetailsEditor({ documentId, currency, customerId, customers, terms, amount, method, reference, description, linked }: Props) {
  return <section className="panel form-panel document-action-panel"><div className="panel-heading"><div><p className="eyebrow">Edit in portal</p><h3>Update receipt</h3><p className="dashboard-note">Save customer, terms, payment, and line item changes here. Totals recalculate automatically and downloads use the saved version.</p></div></div>
    <form action={updateReceiptDetails} className="document-edit-form prototype-form receipt-edit-form" data-single-submit>
      <input type="hidden" name="documentId" value={documentId} />
      <label>Customer / institution<select name="customerId" defaultValue={customerId} disabled={linked} required>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company ? `${customer.company} · ${customer.name}` : customer.name}</option>)}</select>{linked && <input type="hidden" name="customerId" value={customerId} />}</label>
      <label>Terms<textarea name="terms" defaultValue={terms} maxLength={8000} rows={5} placeholder="Enter document-specific payment or delivery terms" /></label>
      <label>Amount received ({currency})<input name="amount" type="number" min="0.01" step="0.01" defaultValue={amount} readOnly required /></label>
      <label>Payment method<select name="method" required defaultValue={method}><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="CARD">Card</option></select></label>
      <label>Payment reference (optional)<input name="reference" maxLength={120} defaultValue={reference ?? ""} /></label>
      <label className="receipt-legacy-description">Receipt entry description<input name="description" minLength={2} maxLength={250} defaultValue={description} required /></label>
      {linked && <p className="dashboard-note receipt-editor-note">The customer stays matched to the linked invoice.</p>}
      <button className="dashboard-button" type="submit">Save changes</button>
    </form>
  </section>;
}
