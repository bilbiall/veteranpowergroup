import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  Document as WordDocument,
  Footer,
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
import { parseLetterHtml, type LetterParagraph, type LetterTextRun, type LetterTextAlignment } from "@/lib/letter-rich-text";

export type LetterheadFormat = "docx" | "xlsx" | "pdf";
export type LetterheadCompany = { name: string; address: string; email: string; phone: string; taxInformation: string };

const companyLogoBytes = () => readFileSync(path.join(process.cwd(), "public", "veteran-document-logo.png"));
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
  const body = formatted.length
    ? formatted.map((paragraph) => new Paragraph({
        alignment: wordAlignment(paragraph.alignment),
        children: paragraph.runs.length ? paragraph.runs.map((run) => new TextRun(textRunFont(run))) : [new TextRun(" ")],
        spacing: { after: 140, line: 300 },
      }))
    : Array.from({ length: 22 }, () => new Paragraph({ text: " ", spacing: { after: 220 } }));
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: documentFooterText, size: 16, color: "68716C" })] })] });
  const paragraphs = [wordHeader(company), new Paragraph({ border: { bottom: { color: "D5DCD6", space: 1, style: "single", size: 6 } }, spacing: { before: 100, after: 300 } }), ...body];
  return Packer.toBuffer(new WordDocument({ sections: [{ footers: { default: footer }, children: paragraphs }] }));
}

async function createSpreadsheet(content: string, company: LetterheadCompany) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = company.name;
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Letter", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.6, header: 0.2, footer: 0.25 } } });
  sheet.columns = Array.from({ length: 7 }, () => ({ width: 16 }));
  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = company.name;
  sheet.getCell("A1").font = { bold: true, size: 17, color: { argb: "FF202A27" } };
  sheet.getCell("A1").alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(1).height = 32;
  let row = 2;
  for (const detail of companyDetails(company)) {
    sheet.mergeCells(`A${row}:E${row}`);
    sheet.getCell(`A${row}`).value = detail;
    sheet.getCell(`A${row}`).font = { size: 10, color: { argb: "FF68716C" } };
    row += 1;
  }
  sheet.addImage(workbook.addImage({ base64: companyLogoBytes().toString("base64"), extension: "png" }), "F1:G3");
  row += 1;
  sheet.mergeCells(`A${row}:G${row}`);
  sheet.getCell(`A${row}`).border = { bottom: { style: "thin", color: { argb: "FFD5DCD6" } } };
  row += 2;
  const formatted = parseLetterHtml(content);
  const lines: LetterParagraph[] = formatted.length ? formatted : Array.from({ length: 22 }, () => ({ runs: [], alignment: "left" as const }));
  for (const paragraph of lines) {
    sheet.mergeCells(`A${row}:G${row}`);
    sheet.getCell(`A${row}`).value = paragraph.runs.length
      ? { richText: paragraph.runs.map((run) => ({ text: run.text, font: { name: run.fontFamily, size: run.fontSize, bold: run.bold, italic: run.italic, underline: run.underline, color: run.color ? { argb: run.color.startsWith("#") ? `FF${run.color.slice(1)}` : run.color } : undefined } })) }
      : " ";
    sheet.getCell(`A${row}`).alignment = { wrapText: true, vertical: "top", horizontal: paragraph.alignment };
    const lineLength = paragraph.runs.reduce((length, run) => length + run.text.length, 0);
    sheet.getRow(row).height = Math.max(22, Math.ceil(Math.max(lineLength, 1) / 94) * 18);
    row += 1;
  }
  sheet.headerFooter.oddFooter = `&C${documentFooterText}     Page &P of &N`;
  sheet.headerFooter.evenFooter = sheet.headerFooter.oddFooter;
  sheet.pageSetup.printArea = `A1:G${row - 1}`;
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
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
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: { Title: "Letter", Author: company.name } });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const left = 48;
    const right = 547;
    const drawContinuationHeader = () => {
      pdf.fillColor("#24433a").font("Helvetica-Bold").fontSize(11).text(company.name, left, 38, { width: 300 });
      pdf.image(companyLogoBytes(), 392, 30, { fit: [150, 54], align: "center", valign: "center" });
      pdf.y = 92;
    };
    drawContinuationHeader();
    pdf.font("Helvetica").fontSize(9).fillColor("#68716c");
    for (const detail of companyDetails(company)) pdf.text(detail, left, undefined, { width: 320 });
    const ruleY = Math.max(pdf.y + 14, 108);
    pdf.save().strokeColor("#d5dcd6").lineWidth(0.8).moveTo(left, ruleY).lineTo(right, ruleY).stroke().restore();
    pdf.y = ruleY + 26;
    pdf.on("pageAdded", drawContinuationHeader);
    const paragraphs = parseLetterHtml(content);
    const body = paragraphs.length ? paragraphs : Array.from({ length: 22 }, () => ({ runs: [], alignment: "left" as const }));
    for (const paragraph of body) {
      const runs = paragraph.runs.length ? paragraph.runs : [{ text: " " }];
      runs.forEach((run, index) => {
        pdf.font(pdfFont(run)).fontSize(run.fontSize ?? 11).fillColor(run.color ?? "#202a27");
        pdf.text(run.text, left, pdf.y, { width: right - left, lineGap: 7, continued: index < runs.length - 1, align: paragraph.alignment });
      });
      pdf.moveDown(0.6);
    }
    const pages = pdf.bufferedPageRange();
    for (let page = 0; page < pages.count; page += 1) {
      pdf.switchToPage(page);
      pdf.fillColor("#68716c").font("Helvetica").fontSize(7).text(documentFooterText, left, 785, { width: right - left, align: "center", lineBreak: false });
      pdf.fontSize(8).text(`Page ${page + 1} of ${pages.count}`, left, 801, { width: right - left, align: "center", lineBreak: false });
    }
    pdf.end();
  });
}

export function buildLetterheadExport(content: string, format: LetterheadFormat, company: LetterheadCompany) {
  if (format === "docx") return createWord(content, company);
  if (format === "xlsx") return createSpreadsheet(content, company);
  return createPdf(content, company);
}
