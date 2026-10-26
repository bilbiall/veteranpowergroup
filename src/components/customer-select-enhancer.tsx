"use client";

import { useEffect } from "react";

type Props = {
  formSelector: string;
  sourceCustomerIds?: Record<string, string>;
};

const customerFields = [
  { name: "newCustomerName", label: "New customer name", type: "text", required: true, maxLength: 120 },
  { name: "newCustomerCompany", label: "Company", type: "text", required: false, maxLength: 120 },
  { name: "newCustomerEmail", label: "Email", type: "email", required: false, maxLength: 254 },
  { name: "newCustomerPhone", label: "Phone", type: "tel", required: false, maxLength: 40 },
];

export default function CustomerSelectEnhancer({ formSelector, sourceCustomerIds = {} }: Props) {
  useEffect(() => {
    const form = window.document.querySelector<HTMLFormElement>(formSelector);
    const customerSelect = form?.querySelector<HTMLSelectElement>('select[name="customerId"]');
    if (!form || !customerSelect || form.dataset.customerEnhanced === "true") return;

    form.dataset.customerEnhanced = "true";
    const sourceSelect = form.querySelector<HTMLSelectElement>('select[name="sourceDocumentId"]');
    const customerLabel = customerSelect.closest("label");
    if (!customerLabel) return;

    const addOption = window.document.createElement("option");
    addOption.value = "__new__";
    addOption.textContent = "+ Add a new customer";
    customerSelect.append(addOption);

    const fields = window.document.createElement("div");
    fields.style.display = "grid";
    fields.style.gap = "14px";
    fields.hidden = true;
    customerLabel.insertAdjacentElement("afterend", fields);

    for (const field of customerFields) {
      const label = window.document.createElement("label");
      label.textContent = field.label;
      const input = window.document.createElement("input");
      input.name = field.name;
      input.type = field.type;
      input.required = field.required;
      input.maxLength = field.maxLength;
      if (field.name === "newCustomerName") input.minLength = 2;
      label.append(input);
      fields.append(label);
    }

    const syncSourceCustomer = () => {
      const sourceId = sourceSelect?.value ?? "";
      if (sourceId) {
        customerSelect.value = sourceCustomerIds[sourceId] ?? "";
        fields.hidden = true;
      }
    };

    sourceSelect?.addEventListener("change", syncSourceCustomer);
    customerSelect.addEventListener("change", () => {
      const sourceId = sourceSelect?.value ?? "";
      if (sourceId && sourceSelect && customerSelect.value !== sourceCustomerIds[sourceId]) {
        sourceSelect.value = "";
        sourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
        form.querySelector<HTMLInputElement>('input[name="amount"]')?.removeAttribute("max");
      }
      if (customerSelect.value === "__new__") {
        fields.hidden = false;
      } else {
        fields.hidden = true;
      }
    });
    syncSourceCustomer();
  }, [formSelector, sourceCustomerIds]);

  return null;
}