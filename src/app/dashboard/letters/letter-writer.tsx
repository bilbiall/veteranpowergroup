"use client";

import { useState } from "react";
import Image from "next/image";

type LetterheadCompany = { name: string; address: string; email: string; phone: string; taxInformation: string };
type LetterFormat = "docx" | "xlsx" | "pdf";

const formats: { key: LetterFormat; label: string; extension: string }[] = [
  { key: "docx", label: "Download Word", extension: "docx" },
  { key: "xlsx", label: "Download Excel", extension: "xlsx" },
  { key: "pdf", label: "Download PDF", extension: "pdf" },
];

export default function LetterWriter({ company }: { company: LetterheadCompany }) {
  const [content, setContent] = useState("");
  const [downloading, setDownloading] = useState<LetterFormat | null>(null);
  const [message, setMessage] = useState("");

  async function download(format: LetterFormat) {
    setDownloading(format);
    setMessage("");
    try {
      const response = await fetch("/api/letters/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format }),
      });
      if (!response.ok) throw new Error("The letter could not be exported. Please try again.");
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Veteran-Power-Solutions-letter.${formats.find((item) => item.key === format)?.extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The letter could not be exported. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  return <section className="letter-template-workspace">
    <div className="letterhead-sheet">
      <header className="letterhead-preview">
        <div className="letterhead-company-details">
          <strong>{company.name}</strong>
          {company.address && <span>{company.address}</span>}
          <span>{[company.email, company.phone].filter(Boolean).join(" · ")}</span>
          {company.taxInformation && <span>{company.taxInformation}</span>}
        </div>
        <Image className="letterhead-logo" src="/veteran-document-logo.png" alt="Veteran Power Solutions Limited logo" width={900} height={320} priority />
      </header>
      <div className="letterhead-rule" />
      <label className="sr-only" htmlFor="letter-body">Write your letter, email, or agreement</label>
      <textarea id="letter-body" className="letter-writing-space" value={content} onChange={(event) => setContent(event.target.value)} aria-label="Blank letter body" spellCheck />
      <footer className="letterhead-footer">Generated from the Veteran Power Solutions Limited staff portal. Confirm company, tax, currency, and legal details before external use.</footer>
    </div>
    <div className="letter-template-actions" aria-label="Download letter">
      {formats.map(({ key, label }) => <button className="export-button" type="button" key={key} onClick={() => void download(key)} disabled={downloading !== null}>
        {downloading === key ? "Preparing…" : label}
      </button>)}
    </div>
    {message && <p className="notice notice-error" role="alert">{message}</p>}
  </section>;
}
