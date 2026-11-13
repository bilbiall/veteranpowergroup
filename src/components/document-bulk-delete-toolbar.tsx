"use client";

import { useEffect, useState } from "react";
import { bulkDeleteDocuments } from "@/app/dashboard/actions";

type DocumentType = "QUOTATION" | "INVOICE" | "RECEIPT";

export default function DocumentBulkDeleteToolbar({ formId, type, label, selectableCount }: {
  formId: string;
  type: DocumentType;
  label: string;
  selectableCount: number;
}) {
  const [selectedCount, setSelectedCount] = useState(0);
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;

  useEffect(() => {
    const updateCount = (event: Event) => {
      const checkbox = event.target;
      if (!(checkbox instanceof HTMLInputElement) || checkbox.name !== "documentIds" || checkbox.form?.id !== formId) return;
      const selector = `input[name="documentIds"][form="${formId}"]:checked`;
      setSelectedCount(document.querySelectorAll<HTMLInputElement>(selector).length);
    };
    document.addEventListener("change", updateCount);
    return () => document.removeEventListener("change", updateCount);
  }, [formId]);

  const selectAll = (checked: boolean) => {
    const selector = `input[name="documentIds"][form="${formId}"]`;
    const checkboxes = document.querySelectorAll<HTMLInputElement>(selector);
    for (const checkbox of checkboxes) checkbox.checked = checked;
    setSelectedCount(checked ? checkboxes.length : 0);
  };

  return <div className="document-bulk-delete-toolbar">
    <form id={formId} action={bulkDeleteDocuments} data-single-submit data-confirm={`Delete the selected ${label}? This cannot be undone.`}>
      <input type="hidden" name="documentType" value={type} />
      <button className="table-delete-button" type="submit" disabled={selectedCount === 0}>Delete selected ({selectedCount})</button>
    </form>
    <label className="bulk-select-all"><input type="checkbox" aria-label={`Select all deletable ${label}`} checked={allSelected} onChange={(event) => selectAll(event.currentTarget.checked)} />Select all</label>
  </div>;
}
