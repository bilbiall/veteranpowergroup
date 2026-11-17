import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  Document as WordDocument,
  Footer,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { documentFooterText } from "@/lib/document-footer";
import { parseLetterHtml, type LetterTextRun, type LetterTextAlignment } from "@/lib/letter-rich-text";

export type LetterheadFormat = "docx" | "pdf";
export type LetterheadCompany = { name: string; address: string; email: string; phone: string; taxInformation: string };

const companyLogoBytes = () => readFileSync(path.join(process.cwd(), "public", "veteran-document-logo.png"));
const contactQrBytes = () => readFileSync(path.join(process.cwd(), "public", "letter-contact-qr.png"));
const companyDetails = (company: LetterheadCompany) => [company.address, [company.email, company.phone].filter(Boolean).join(" · "), company.taxInformation].filter(Boolean);

function wordHeader(company: LetterheadCompany) {
  const details = [company.name, ...companyDetails(company)];
  const left = new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 68, type: WidthType.PERCENTAGE },
    children: details.map((text, index) => new Paragraph({ children: [new TextRun({ text, bold: index === 0, size: index === 0 ? 28 : 18 })], spacing: { after: index === 0 ? 110 : 40 } })),
  });
  const logo = new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 32, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: "png", data: Uint8Array.from(companyLogoBytes()).buffer as ArrayBuffer, transformation: { width: 180, height: 63 } })] })],
  });
  return new Table({
    rows: [new TableRow({ children: [left, logo] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: "none", size: 0, color: "FFFFFF" }, bottom: { style: "none", size: 0, color: "FFFFFF" }, left: { style: "none", size: 0, color: "FFFFFF" }, right: { style: "none", size: 0, color: "FFFFFF" }, insideHorizontal: { style: "none", size: 0, color: "FFFFFF" }, insideVertical: { style: "none", size: 0, color: "FFFFFF" } },
  });
}

const wordAlignment = (alignment: LetterTextAlignment) => ({ left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[alignment]);
const textRunFont = (run: LetterTextRun) => ({
  text: run.text,
  bold: run.bold,
  italics: run.italic,
  underline: run.underline ? {} : undefined,
  font: run.fontFamily,
  size: run.fontSize ? Math.round(run.fontSize * 2) : undefined,
  color: run.color?.replace(/^#/, "").toUpperCase(),
});

async function createWord(content: string, company: LetterheadCompany) {
  const formatted = parseLetterHtml(content);
  const contactQr = Uint8Array.from(contactQrBytes()).buffer as ArrayBuffer;
  const body = formatted.length
    ? formatted.map((paragraph) => new Paragraph({
        alignment: wordAlignment(paragraph.alignment),
        children: paragraph.runs.length ? paragraph.runs.map((run) => run.imageData
          ? new ImageRun({ type: run.imageData.startsWith("data:image/png") ? "png" : run.imageData.startsWith("data:image/gif") ? "gif" : "jpg", data: Buffer.from(run.imageData.split(",")[1], "base64"), transformation: { width: run.imageWidth ?? 300, height: run.imageHeight ?? 150 } })
          : new TextRun(textRunFont(run))) : [new TextRun(" ")],
        spacing: { after: 140, line: 300 },
      }))
    : Array.from({ length: 22 }, () => new Paragraph({ text: " ", spacing: { after: 220 } }));
  const footer = new Footer({ children: [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      new TableCell({ columnSpan: 2, children: [new Paragraph({ children: [new ImageRun({ type: "png", data: contactQr, transformation: { width: 42, height: 42 }, altText: { title: "Scan to contact us", description: "Veteran Power Solutions contact page", name: "Contact QR code" } }), new TextRun({ text: "  Scan to contact us", size: 12, color: "68716C" })] }), new Paragraph({ children: [new TextRun({ text: documentFooterText, size: 13, color: "68716C" })] })] }),
    ] })],
    borders: { top: { style: "single", size: 4, color: "E4E8E4" }, bottom: { style: "none", size: 0, color: "FFFFFF" }, left: { style: "none", size: 0, color: "FFFFFF" }, right: { style: "none", size: 0, color: "FFFFFF" }, insideHorizontal: { style: "none", size: 0, color: "FFFFFF" }, insideVertical: { style: "none", size: 0, color: "FFFFFF" } },
  })] });
  const header = new Header({ children: [wordHeader(company), new Paragraph({ border: { bottom: { color: "D5DCD6", space: 1, style: "single", size: 6 } } })] });
  return Packer.toBuffer(new WordDocument({ sections: [{ headers: { default: header }, footers: { default: footer }, children: body }] }));
}

function pdfFont(run: LetterTextRun) {
  const family = (run.fontFamily ?? "").toLowerCase();
  const style = `${run.bold ? "bold" : ""}${run.italic ? "italic" : ""}`;
  if (/times|georgia|cambria/.test(family)) {
    if (style === "bolditalic") return "Times-BoldItalic";
    if (style === "bold") return "Times-Bold";
    if (style === "italic") return "Times-Italic";
    return "Times-Roman";
  }
  if (/courier|consolas|monospace/.test(family)) {
    if (style === "bolditalic") return "Courier-BoldOblique";
    if (style === "bold") return "Courier-Bold";
    if (style === "italic") return "Courier-Oblique";
    return "Courier";
  }
  if (style === "bolditalic") return "Helvetica-BoldOblique";
  if (style === "bold") return "Helvetica-Bold";
  if (style === "italic") return "Helvetica-Oblique";
  return "Helvetica";
}

async function createPdf(content: string, company: LetterheadCompany) {
  const qrBytes = contactQrBytes();
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margins: { top: 145, bottom: 86, left: 48, right: 48 }, bufferPages: true, info: { Title: "Letter", Author: company.name } });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const left = 48;
    const right = 547;
    const drawContinuationHeader = () => {
      pdf.fillColor("#24433a").font("Helvetica-Bold").fontSize(11).text(company.name, left, 38, { width: 300 });
      pdf.image(companyLogoBytes(), 392, 30, { fit: [150, 54], align: "center", valign: "center" });
      pdf.font("Helvetica").fontSize(9).fillColor("#68716c");
      for (const detail of companyDetails(company)) pdf.text(detail, left, undefined, { width: 320 });
      const ruleY = Math.max(pdf.y + 12, 105);
      pdf.save().strokeColor("#d5dcd6").lineWidth(0.8).moveTo(left, ruleY).lineTo(right, ruleY).stroke().restore();
      pdf.y = 130;
    };
    drawContinuationHeader();
    const drawFooter = (page: number, total: number) => {
      const footerY = 756;
      pdf.save().strokeColor("#e4e8e4").lineWidth(0.6).moveTo(left, footerY).lineTo(right, footerY).stroke().restore();
      pdf.image(qrBytes, left, footerY + 3, { fit: [42, 42] });
      pdf.fillColor("#68716c").font("Helvetica").fontSize(8).text("Scan to contact us", left + 50, footerY + 18, { width: 130, lineBreak: false });
      pdf.font("Helvetica").fontSize(7).text(documentFooterText, left, footerY + 52, { width: right - left, height: 18, lineBreak: false });
      pdf.font("Helvetica").fontSize(8).text(`Page ${page} of ${total}`, left, 828, { width: right - left, align: "center", lineBreak: false });
    };
    pdf.on("pageAdded", drawContinuationHeader);
    const paragraphs = parseLetterHtml(content);
    const body = paragraphs.length ? paragraphs : Array.from({ length: 22 }, () => ({ runs: [], alignment: "left" as const }));
    for (const paragraph of body) {
      const runs = paragraph.runs.length ? paragraph.runs : [{ text: " " }];
      runs.forEach((run, index) => {
        if (run.imageData) {
          pdf.image(Buffer.from(run.imageData.split(",")[1], "base64"), left, pdf.y, { fit: [run.imageWidth ?? 300, run.imageHeight ?? 200] });
          pdf.moveDown(0.5);
          return;
        }
        pdf.font(pdfFont(run)).fontSize(run.fontSize ?? 11).fillColor(run.color ?? "#202a27");
        pdf.text(run.text, left, pdf.y, { width: right - left, lineGap: 7, continued: index < runs.length - 1, align: paragraph.alignment });
      });
      pdf.moveDown(0.6);
    }
    const pages = pdf.bufferedPageRange();
    for (let page = 0; page < pages.count; page += 1) {
      pdf.switchToPage(page);
      drawFooter(page + 1, pages.count);
    }
    pdf.end();
  });
}

export function buildLetterheadExport(content: string, format: LetterheadFormat, company: LetterheadCompany) {
  if (format === "docx") return createWord(content, company);
  return createPdf(content, company);
}
