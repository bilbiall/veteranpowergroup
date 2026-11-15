"use client";

import { useState } from "react";

type Row = { description: string; quantity: string; unitPrice: string; discount: string; taxRate: string };

const emptyRow = (taxRate = "0"): Row => ({ description: "", quantity: "1", unitPrice: "0", discount: "0", taxRate });

export default function LineItemEditor({ prefix = "", currency = "KES", initialRows, defaultTaxRate = 0 }: { prefix?: string; currency?: string; initialRows?: Row[]; defaultTaxRate?: number }) {
  const [rows, setRows] = useState(initialRows ?? [emptyRow(String(defaultTaxRate))]);
  const total = rows.reduce((sum, row) => {
    const amount = Math.max(0, Number(row.quantity || 0) * Number(row.unitPrice || 0) - Number(row.discount || 0));
    return sum + amount + amount * Number(row.taxRate || 0) / 100;
  }, 0);
  const field = (name: string) => prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;

  return <div className="line-item-editor">
    <div className="table-scroll"><table className="document-edit-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price ({currency})</th><th>Discount ({currency})</th><th>Tax rate (%)</th><th>Action</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>
        <td><input aria-label={`Description ${index + 1}`} name={field("description")} value={row.description} onChange={(event) => setRows(rows.map((entry, rowIndex) => rowIndex === index ? { ...entry, description: event.target.value } : entry))} minLength={2} maxLength={250} required /></td>
        <td><input aria-label={`Quantity ${index + 1}`} name={field("quantity")} type="number" min="0.01" step="0.01" value={row.quantity} onChange={(event) => setRows(rows.map((entry, rowIndex) => rowIndex === index ? { ...entry, quantity: event.target.value } : entry))} required /></td>
        <td><input aria-label={`Unit price ${index + 1}`} name={field("unitPrice")} type="number" min="0" step="0.01" value={row.unitPrice} onChange={(event) => setRows(rows.map((entry, rowIndex) => rowIndex === index ? { ...entry, unitPrice: event.target.value } : entry))} required /></td>
        <td><input aria-label={`Discount ${index + 1}`} name={field("discount")} type="number" min="0" step="0.01" value={row.discount} onChange={(event) => setRows(rows.map((entry, rowIndex) => rowIndex === index ? { ...entry, discount: event.target.value } : entry))} required /></td>
        <td><input aria-label={`Tax rate ${index + 1}`} name={field("taxRate")} type="number" min="0" max="100" step="0.01" value={row.taxRate} onChange={(event) => setRows(rows.map((entry, rowIndex) => rowIndex === index ? { ...entry, taxRate: event.target.value } : entry))} required /><input type="hidden" name={field("itemId")} value="" /></td>
        <td><button className="line-item-remove" type="button" onClick={() => rows.length > 1 && setRows(rows.filter((_, rowIndex) => rowIndex !== index))} disabled={rows.length === 1} aria-label={`Remove entry ${index + 1}`}>Remove</button></td>
      </tr>)}</tbody></table></div>
    <button className="dashboard-button secondary-button" type="button" onClick={() => setRows([...rows, emptyRow(String(defaultTaxRate))])}>Add another entry</button>
    <p className="line-item-total" aria-live="polite">Entries: {rows.length} · Total: {currency} {total.toFixed(2)}</p>
  </div>;
}
