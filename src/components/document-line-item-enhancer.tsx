"use client";

import { useEffect } from "react";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
};

type Props = {
  documentId: string;
  documentType: string;
  items: LineItem[];
};

function createInput(name: string, label: string, type: string, value: string, minimum?: string, maximum?: string) {
  const input = window.document.createElement("input");
  input.name = name;
  input.type = type;
  input.setAttribute("aria-label", label);
  input.required = true;
  if (type === "number") input.step = "0.01";
  if (minimum !== undefined) input.min = minimum;
  if (maximum !== undefined) input.max = maximum;
  if (value) input.value = value;
  return input;
}

function addDocumentRow(tbody: HTMLTableSectionElement, item?: LineItem, fieldPrefix = "", itemIdName = "itemId") {
  const row = window.document.createElement("tr");
  const fields = [
    { name: "description", label: "Description", type: "text", value: item?.description ?? "", min: undefined, max: undefined },
    { name: "quantity", label: "Quantity", type: "number", value: String(item?.quantity ?? 1), min: "0.01", max: undefined },
    { name: "unitPrice", label: "Unit price", type: "number", value: String(item?.unitPrice ?? 0), min: "0", max: undefined },
    { name: "discount", label: "Discount", type: "number", value: String(item?.discount ?? 0), min: "0", max: undefined },
    { name: "taxRate", label: "Tax rate", type: "number", value: String(item?.taxRate ?? 0), min: "0", max: "100" },
  ];

  for (const field of fields) {
    const cell = window.document.createElement("td");
    const input = createInput(`${fieldPrefix}${field.name}`, field.label, field.type, field.value, field.min, field.max);
    if (field.name === "description") {
      input.minLength = 2;
      input.maxLength = 250;
      input.placeholder = item ? "" : "Add new line item";
    }
    cell.append(input);
    if (field.name === "taxRate") {
      const itemId = window.document.createElement("input");
      itemId.type = "hidden";
      itemId.name = itemIdName;
      itemId.value = item?.id ?? "";
      cell.append(itemId);
    }
    row.append(cell);
  }
  tbody.append(row);
}

function appendAddButton(parent: Element, onAdd: () => void) {
  const button = window.document.createElement("button");
  button.className = "dashboard-button secondary-button";
  button.type = "button";
  button.textContent = "Add another entry";
  button.addEventListener("click", onAdd);
  parent.append(button);
}

export default function DocumentLineItemEnhancer({ documentId, documentType, items }: Props) {
  useEffect(() => {
    if (documentType === "QUOTATION" || documentType === "INVOICE") {
      const form = window.document.querySelector<HTMLFormElement>(".document-edit-form");
      const tbodyElement = window.document.getElementById(`document-items-${documentId}`);
      if (!(tbodyElement instanceof HTMLTableSectionElement)) return;
      const tbody = tbodyElement;
      const tableScroll = tbody?.closest(".table-scroll");
      if (!form || !tbody || !tableScroll || form.dataset.rowsEnhanced === "true") return;

      form.dataset.rowsEnhanced = "true";
      const existingRows = Array.from(tbody.rows);
      existingRows.forEach((row, index) => {
        const lastCell = row.cells.item(row.cells.length - 1);
        if (!lastCell || lastCell.querySelector('input[name="itemId"]')) return;
        const itemId = window.document.createElement("input");
        itemId.type = "hidden";
        itemId.name = "itemId";
        itemId.value = items[index]?.id ?? "";
        lastCell.append(itemId);
      });

      const buttonHost = window.document.createElement("div");
      tableScroll.insertAdjacentElement("afterend", buttonHost);
      appendAddButton(buttonHost, () => addDocumentRow(tbody));
      return;
    }

    if (documentType !== "RECEIPT") return;
    const form = window.document.querySelector<HTMLFormElement>(".receipt-edit-form");
    if (!form || form.dataset.rowsEnhanced === "true") return;
    const amountInput = form.querySelector<HTMLInputElement>('input[name="amount"]');
    const descriptionLabel = form.querySelector<HTMLInputElement>('input[name="description"]')?.closest("label");
    if (!amountInput || !descriptionLabel) return;

    form.dataset.rowsEnhanced = "true";
    amountInput.readOnly = true;
    descriptionLabel.hidden = true;
    const legacyDescriptionInput = descriptionLabel.querySelector<HTMLInputElement>("input");
    if (legacyDescriptionInput) legacyDescriptionInput.disabled = true;

    const tableScroll = window.document.createElement("div");
    tableScroll.className = "table-scroll";
    const table = window.document.createElement("table");
    table.className = "document-edit-table";
    const header = window.document.createElement("thead");
    const headerRow = window.document.createElement("tr");
    for (const title of ["Description", "Quantity", `Unit price (${amountInput.closest("label")?.textContent?.match(/\(([^)]+)\)/)?.[1] ?? "currency"})`, "Discount", "Tax rate (%)"]) {
      const cell = window.document.createElement("th");
      cell.textContent = title;
      headerRow.append(cell);
    }
    header.append(headerRow);
    const tbody = window.document.createElement("tbody");
    table.append(header, tbody);
    tableScroll.append(table);
    descriptionLabel.insertAdjacentElement("beforebegin", tableScroll);
    items.forEach((item) => addDocumentRow(tbody, item, "receipt", "receiptItemId"));

    const buttonHost = window.document.createElement("div");
    tableScroll.insertAdjacentElement("afterend", buttonHost);
    const updateTotal = () => {
      const total = Array.from(tbody.rows).reduce((sum, row) => {
        const quantity = Number(row.querySelector<HTMLInputElement>('input[name="receiptQuantity"]')?.value ?? 0);
        const unitPrice = Number(row.querySelector<HTMLInputElement>('input[name="receiptUnitPrice"]')?.value ?? 0);
        const discount = Number(row.querySelector<HTMLInputElement>('input[name="receiptDiscount"]')?.value ?? 0);
        const taxRate = Number(row.querySelector<HTMLInputElement>('input[name="receiptTaxRate"]')?.value ?? 0);
        const lineAmount = Math.round((quantity * unitPrice - discount) * 100) / 100;
        return sum + lineAmount + Math.round(lineAmount * taxRate) / 100;
      }, 0);
      amountInput.value = (Math.round(total * 100) / 100).toFixed(2);
    };
    tbody.addEventListener("input", updateTotal);
    appendAddButton(buttonHost, () => {
      addDocumentRow(tbody, undefined, "receipt", "receiptItemId");
      updateTotal();
    });
    updateTotal();
  }, [documentId, documentType, items]);

  return null;
}