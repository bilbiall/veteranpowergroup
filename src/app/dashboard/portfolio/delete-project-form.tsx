"use client";

import type { FormEvent } from "react";

type DeleteProjectFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  projectId: string;
  projectTitle: string;
};

export function DeleteProjectForm({ action, projectId, projectTitle }: DeleteProjectFormProps) {
  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`Delete “${projectTitle}” from the portfolio? Its attached media will also be removed.`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={confirmDelete}>
      <input type="hidden" name="id" value={projectId} />
      <button className="portfolio-delete-button" type="submit" aria-label={`Delete ${projectTitle}`}>
        Delete project
      </button>
    </form>
  );
}
