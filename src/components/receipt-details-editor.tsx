import { updateReceiptDetails } from "@/app/dashboard/actions";

type Props = {
  documentId: string;
  currency: string;
  amount: number;
  method: "CASH" | "CARD" | "BANK_TRANSFER" | "MOBILE_MONEY";
  reference: string | null;
  description: string;
};

export default function ReceiptDetailsEditor({ documentId, currency, amount, method, reference, description }: Props) {
  return <section className="panel form-panel document-action-panel"><div className="panel-heading"><div><p className="eyebrow">Edit saved receipt</p><h3>Correct receipt details</h3><p className="dashboard-note">Receipt entries determine the payment total. Linked invoice or quotation balances are checked when you save.</p></div></div><form action={updateReceiptDetails} className="prototype-form receipt-edit-form"><input type="hidden" name="documentId" value={documentId} /><label>Amount received ({currency})<input name="amount" type="number" min="0.01" step="0.01" defaultValue={amount} required /></label><label>Payment method<select name="method" required defaultValue={method}><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="CARD">Card</option></select></label><label>Payment reference (optional)<input name="reference" maxLength={120} defaultValue={reference ?? ""} /></label><label>Receipt entry description<input name="description" minLength={2} maxLength={250} defaultValue={description} required /></label><button className="dashboard-button" type="submit">Save receipt changes</button></form></section>;
}