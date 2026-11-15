"use client";

import { useState } from "react";

type ContactActionsProps = {
  website: string;
  address: string;
  phone: string;
  email: string;
};

export function ContactActions({ website, address, phone, email }: ContactActionsProps) {
  const [shareMessage, setShareMessage] = useState("");

  function saveContact() {
    const escapeVCard = (value: string) => value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
    const vCard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Veteran Power Solutions Limited",
      "ORG:Veteran Power Solutions Limited",
      `TEL;TYPE=WORK,VOICE:${phone}`,
      `EMAIL;TYPE=WORK:${email}`,
      `ADR;TYPE=WORK:;;${escapeVCard(address)};;;;`,
      `URL:${website}`,
      "END:VCARD",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([vCard], { type: "text/vcard;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "veteran-power-solutions.vcf";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function shareContact() {
    const shareData = { title: "Veteran Power Solutions Limited", text: `Contact Veteran Power Solutions Limited · ${phone}`, url: website };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        setShareMessage("Contact details copied.");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") setShareMessage("Sharing is unavailable in this browser.");
    }
  }

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

  return <div className="contact-actions" aria-label="Contact actions">
    <a className="contact-action" href={website}><span aria-hidden="true">◉</span> Website</a>
    <a className="contact-action" href={directions} target="_blank" rel="noreferrer"><span aria-hidden="true">⌖</span> Directions</a>
    <button className="contact-action" type="button" onClick={saveContact}><span aria-hidden="true">♧</span> Save</button>
    <button className="contact-action" type="button" onClick={shareContact}><span aria-hidden="true">↗</span> Share</button>
    <a className="contact-action" href={`tel:${phone.replaceAll(" ", "")}`}><span aria-hidden="true">☎</span> Call</a>
    {shareMessage && <span className="contact-action-feedback" role="status">{shareMessage}</span>}
  </div>;
}
