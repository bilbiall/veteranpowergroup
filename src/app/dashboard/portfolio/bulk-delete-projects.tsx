"use client";

import type { FormEvent } from "react";

export function BulkDeleteProjects({ action, projectCount }: { action: (formData: FormData) => void | Promise<void>; projectCount: number }) {
  function confirmBulkDelete(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    const mode = submitter instanceof HTMLButtonElement ? submitter.value : "selected";

    if (mode === "all") {
      if (!window.confirm(`Delete all ${projectCount} portfolio projects? Their attached media will also be removed.`)) event.preventDefault();
      return;
    }

    const selectedCount = new FormData(form).getAll("projectIds").length;
    if (selectedCount === 0) {
      event.preventDefault();
      window.alert("Select at least one project to delete.");
      return;
    }
    if (!window.confirm(`Delete ${selectedCount} selected portfolio project${selectedCount === 1 ? "" : "s"}? Their attached media will also be removed.`)) event.preventDefault();
  }

  return <form id="bulk-delete-projects" action={action} onSubmit={confirmBulkDelete} className="portfolio-bulk-delete-form">
    <input type="hidden" name="projectCount" value={projectCount} />
    <button className="portfolio-delete-button" type="submit" name="mode" value="selected" disabled={projectCount === 0}>Delete selected</button>
    <button className="portfolio-delete-all-button" type="submit" name="mode" value="all" disabled={projectCount === 0}>Delete all ({projectCount})</button>
  </form>;
}
