"use client";

import { useState } from "react";

export type CustomerOption = { id: string; name: string; company: string | null };

type Props = {
  customers: CustomerOption[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (customerId: string) => void;
  onAddNew?: () => void;
};

export default function CustomerSelect({ customers, value, defaultValue = "", disabled = false, onChange, onAddNew }: Props) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value ?? internalValue;

  const handleChange = (customerId: string) => {
    if (value === undefined) setInternalValue(customerId);
    onChange?.(customerId);
    if (customerId === "__new__") onAddNew?.();
  };

  return <>
    <label>Customer<select name="customerId" value={selectedValue} onChange={(event) => handleChange(event.target.value)} required disabled={disabled}>
      <option value="" disabled>Select a customer</option>
      {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company ? `${customer.company} · ${customer.name}` : customer.name}</option>)}
      {!disabled && <option value="__new__">+ Add a new customer</option>}
    </select></label>
    {selectedValue === "__new__" && <>
      <label>Customer name<input name="newCustomerName" required minLength={2} maxLength={120} /></label>
      <label>Company<input name="newCustomerCompany" maxLength={120} /></label>
      <label>Email<input name="newCustomerEmail" type="email" /></label>
      <label>Phone<input name="newCustomerPhone" maxLength={40} /></label>
    </>}
  </>;
}