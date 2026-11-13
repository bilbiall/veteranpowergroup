"use client";

import { useEffect } from "react";

export default function SingleSubmitGuard() {
  useEffect(() => {
    const handleSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-single-submit")) return;

      if (form.dataset.submitLocked === "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const confirmation = form.dataset.confirm;
      if (confirmation && !window.confirm(confirmation)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      form.dataset.submitLocked = "true";
      form.setAttribute("aria-busy", "true");
      window.setTimeout(() => {
        for (const button of Array.from(form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"]'))) {
          button.disabled = true;
          if (button instanceof HTMLButtonElement) button.textContent = "Saving…";
          else button.value = "Saving…";
        }
      }, 0);
    };

    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, []);

  return null;
}
