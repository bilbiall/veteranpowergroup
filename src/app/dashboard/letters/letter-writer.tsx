"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type LetterheadCompany = { name: string; address: string; email: string; phone: string; taxInformation: string };
type LetterFormat = "docx" | "xlsx" | "pdf";

const formats: { key: LetterFormat; label: string; extension: string }[] = [
  { key: "docx", label: "Download Word", extension: "docx" },
  { key: "xlsx", label: "Download Excel", extension: "xlsx" },
  { key: "pdf", label: "Download PDF", extension: "pdf" },
];

const fontChoices = ["Arial", "Aptos", "Calibri", "Cambria", "Courier New", "Georgia", "Tahoma", "Times New Roman", "Verdana"];
const allowedTags = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "FONT", "OL", "UL", "LI", "H1", "H2", "H3", "BLOCKQUOTE"]);

function safeFontFamily(value: string) {
  const clean = value.replace(/["']/g, "").trim();
  return clean.length <= 120 && /^[\w\s,()-]+$/.test(clean) && !/url|expression|var\(/i.test(clean) ? clean : "";
}

function safeColor(value: string) {
  const clean = value.trim();
  return /^#[\da-f]{3,8}$/i.test(clean) || /^rgba?\([\d\s.,%]+\)$/i.test(clean) || /^[a-z]{3,20}$/i.test(clean) ? clean : "";
}

function cleanHtmlNode(node: Node, target: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return target.createTextNode(node.textContent ?? "");
  if (!(node instanceof Element)) return null;
  if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH"].includes(node.tagName)) return null;
  if (!allowedTags.has(node.tagName)) {
    const fragment = target.createDocumentFragment();
    for (const child of Array.from(node.childNodes)) {
      const clean = cleanHtmlNode(child, target);
      if (clean) fragment.append(clean);
    }
    return fragment;
  }

  const htmlElement = node as HTMLElement;
  const clean = target.createElement(node.tagName.toLowerCase());
  const fontFace = node.getAttribute("face");
  const fontFamily = safeFontFamily(htmlElement.style.fontFamily || fontFace || "");
  const fontSize = htmlElement.style.fontSize.trim();
  const color = safeColor(htmlElement.style.color || node.getAttribute("color") || "");
  const align = htmlElement.style.textAlign;
  const weight = htmlElement.style.fontWeight;
  const fontStyle = htmlElement.style.fontStyle;
  const decoration = htmlElement.style.textDecorationLine || htmlElement.style.textDecoration;
  const styles: string[] = [];
  if (fontFamily) styles.push(`font-family:${fontFamily}`);
  if (/^(\d+(\.\d+)?(pt|px|em|rem|%))$/i.test(fontSize)) styles.push(`font-size:${fontSize}`);
  if (color) styles.push(`color:${color}`);
  if (["left", "center", "right", "justify"].includes(align)) styles.push(`text-align:${align}`);
  if (weight.toLowerCase() === "bold" || Number(weight) >= 600) styles.push("font-weight:bold");
  if (/italic|oblique/i.test(fontStyle)) styles.push("font-style:italic");
  if (/underline/i.test(decoration)) styles.push("text-decoration:underline");
  if (styles.length) clean.setAttribute("style", styles.join(";"));
  for (const child of Array.from(node.childNodes)) {
    const sanitized = cleanHtmlNode(child, target);
    if (sanitized) clean.append(sanitized);
  }
  return clean;
}

function sanitizeHtml(html: string) {
  const source = new DOMParser().parseFromString(html, "text/html");
  const output = document.implementation.createHTMLDocument("");
  const fragment = output.createDocumentFragment();
  for (const child of Array.from(source.body.childNodes)) {
    const clean = cleanHtmlNode(child, output);
    if (clean) fragment.append(clean);
  }
  const container = output.createElement("div");
  container.append(fragment);
  return container.innerHTML;
}

function pastePlainText(text: string) {
  const temporary = document.createElement("div");
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (index) temporary.append(document.createElement("br"));
    temporary.append(document.createTextNode(line));
  }
  return temporary.innerHTML;
}

export default function LetterWriter({ company, draftKey }: { company: LetterheadCompany; draftKey: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [downloading, setDownloading] = useState<LetterFormat | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(draftKey);
    if (!saved || !editorRef.current) return;
    const safe = sanitizeHtml(saved);
    editorRef.current.innerHTML = safe;
    setContent(safe);
    setMessage("Saved draft restored from this browser.");
  }, [draftKey]);

  function updateContent() {
    const editor = editorRef.current;
    if (!editor) return;
    const safe = sanitizeHtml(editor.innerHTML);
    setContent(safe);
    setMessage("");
  }

  function saveDraft() {
    const editor = editorRef.current;
    if (!editor) return;
    const safe = sanitizeHtml(editor.innerHTML);
    editor.innerHTML = safe;
    setContent(safe);
    window.localStorage.setItem(draftKey, safe);
    setMessage("Draft saved in this browser.");
  }

  function formatSelection(command: "bold" | "italic") {
    editorRef.current?.focus();
    document.execCommand(command, false);
    updateContent();
  }

  function changeFont(font: string) {
    if (!font) return;
    editorRef.current?.focus();
    document.execCommand("fontName", false, font);
    updateContent();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const fragmentHtml = sanitizeHtml(html || pastePlainText(text));
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const container = document.createElement("div");
    container.innerHTML = fragmentHtml;
    const fragment = document.createDocumentFragment();
    let last: Node | null = null;
    while (container.firstChild) {
      last = container.firstChild;
      fragment.append(container.firstChild);
    }
    range.insertNode(fragment);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateContent();
  }

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
      <div className="letter-writing-toolbar" role="toolbar" aria-label="Text formatting">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("bold")} aria-label="Bold"><strong>B</strong></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("italic")} aria-label="Italic"><em>I</em></button>
        <label className="sr-only" htmlFor="letter-font">Font family</label>
        <select id="letter-font" defaultValue="" onChange={(event) => { changeFont(event.target.value); event.currentTarget.value = ""; }} aria-label="Font family">
          <option value="">Font family…</option>
          {fontChoices.map((font) => <option key={font} value={font}>{font}</option>)}
        </select>
        <span>Paste formatted text from Word, email, or other apps to keep its styling.</span>
      </div>
      <label className="sr-only" htmlFor="letter-body">Write your letter, email, or agreement</label>
      <div id="letter-body" ref={editorRef} className="letter-writing-space" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Letter body" spellCheck onInput={updateContent} onPaste={handlePaste} />
      <footer className="letterhead-footer">Generated from the Veteran Power Solutions Limited staff portal. Confirm company, tax, currency, and legal details before external use.</footer>
    </div>
    <div className="letter-template-actions" aria-label="Save and download letter">
      <button className="export-button" type="button" onClick={saveDraft}>Save draft</button>
      {formats.map(({ key, label }) => <button className="export-button" type="button" key={key} onClick={() => void download(key)} disabled={downloading !== null}>
        {downloading === key ? "Preparing…" : label}
      </button>)}
    </div>
    {message && <p className="notice" role="status">{message}</p>}
  </section>;
}
