import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document as WordDocument,
  Header,
  HeadingLevel,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextWrappingType,
  TextRun,
  VerticalPositionRelativeFrom,
  WidthType,
} from "docx";
import {
  documentStatus,
  documentTypeLabel,
  formatDocumentCurrency,
  receiptPaymentSummary,
  type ExportDocument,
  formatDocumentNumber,
} from "@/lib/document-export-data";

export type ExportFormat = "docx" | "xlsx" | "pdf";

const watermarkPath = path.join(process.cwd(), "public", "veteran-watermark.png");
const getWatermark = () => readFileSync(watermarkPath);

function documentTitle(document: ExportDocument) {
  return `${documentTypeLabel(document.type)} ${document.number}`;
}

function documentTerms(document: ExportDocument) {
  return document.terms ?? document.company.documents?.terms ?? "";
}

function relatedDocumentLines(document: ExportDocument) {
  const lines: string[] = [];
  if (document.sourceDocument) lines.push(`${document.type === "INVOICE" ? "Quotation number" : "Invoice number"}: ${document.sourceDocument.number}`);
  if (document.type === "RECEIPT" && document.sourceDocument?.sourceDocument) lines.push(`Quotation number: ${document.sourceDocument.sourceDocument.number}`);
  if (document.derivedDocuments.length) lines.push(`Installment invoices: ${document.derivedDocuments.map((item) => item.number).join(", ")}`);
  if (document.payments.length) lines.push(`Payments received: ${document.payments.map((payment) => `${formatDocumentCurrency(payment.amount, document.currency)} via ${payment.method.replaceAll("_", " ")} · receipt ${payment.receipt.number}`).join("; ")}`);
  const receiptSummary = receiptPaymentSummary(document);
  if (receiptSummary) lines.push(`${receiptSummary.kind}; remaining invoice balance: ${formatDocumentCurrency(receiptSummary.remaining, document.currency)}`);
  return lines;
}

function institutionLogo(document: ExportDocument) {
  return document.media.find((item) => item.title?.endsWith(" logo") && item.url.startsWith("data:image/"))
    ?? document.customer.media.find((item) => item.title?.endsWith(" logo") && item.url.startsWith("data:image/"));
}

function logoBytes(url: string) {
  const base64 = url.slice(url.indexOf(",") + 1);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function wordCell(value: string, bold = false) {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, bold, size: 18 })] })] });
}

async function createWordDocument(document: ExportDocument) {
  const company = document.company.profile;
  const schoolLogo = institutionLogo(document);
  const companyContact = [company?.email, company?.phone].filter((value): value is string => Boolean(value));
  const rows = [
    new TableRow({ children: ["Description", "Qty", `Unit price (${document.currency})`, `Discount (${document.currency})`, `Tax (${document.currency})`, `Total (${document.currency})`].map((value) => wordCell(value, true)) }),
    ...document.items.map((item) => new TableRow({ children: [
      wordCell(item.description),
      wordCell(formatDocumentNumber(item.quantity)),
      wordCell(formatDocumentCurrency(item.unitPrice, document.currency)),
      wordCell(formatDocumentCurrency(item.discount, document.currency)),
      wordCell(formatDocumentCurrency(item.taxAmount, document.currency)),
      wordCell(formatDocumentCurrency(item.total, document.currency)),
    ] })),
  ];
  const section = [
    ...(schoolLogo ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: schoolLogo.mimeType === "image/png" ? "png" : "jpg", data: logoBytes(schoolLogo.url).buffer as ArrayBuffer, transformation: { width: 120, height: 72 } })] })] : []),
    new Paragraph({ text: company?.name ?? "Company details to be confirmed", heading: HeadingLevel.HEADING_2 }),
    ...(company?.address ? [new Paragraph(company.address)] : []),
    ...(companyContact.length ? [new Paragraph(companyContact.join(" · "))] : []),
    ...(company?.taxInformation ? [new Paragraph(`Tax information: ${company.taxInformation}`)] : []),
    new Paragraph({ text: documentTitle(document), heading: HeadingLevel.TITLE, spacing: { before: 280, after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: `Status: ${documentStatus(document)}`, bold: true }), new TextRun(`    Currency: ${document.currency}    Date: ${document.createdAt.toLocaleDateString("en")}`)] }),
    new Paragraph({ text: "Bill to", heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: document.customer.company || document.customer.name, bold: true })] }),
    ...(document.customer.company && document.customer.name ? [new Paragraph(document.customer.name)] : []),
    ...([document.customer.address, document.customer.email, document.customer.phone].filter(Boolean).map((value) => new Paragraph(value!))),
    ...relatedDocumentLines(document).map((line) => new Paragraph(line)),
    new Paragraph({ text: "Items", heading: HeadingLevel.HEADING_3, spacing: { before: 260, after: 100 } }),
    new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 5, color: "AEB8B1" },
        bottom: { style: BorderStyle.SINGLE, size: 5, color: "AEB8B1" },
        left: { style: BorderStyle.SINGLE, size: 5, color: "AEB8B1" },
        right: { style: BorderStyle.SINGLE, size: 5, color: "AEB8B1" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D4DAD5" },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D4DAD5" },
      },
    }),
    new Paragraph({ text: `Subtotal: ${formatDocumentCurrency(document.subtotal, document.currency)}`, alignment: AlignmentType.RIGHT, spacing: { before: 200 } }),
    new Paragraph({ text: `Tax: ${formatDocumentCurrency(document.tax, document.currency)}`, alignment: AlignmentType.RIGHT }),
    new Paragraph({ children: [new TextRun({ text: `Total: ${formatDocumentCurrency(document.total, document.currency)}`, bold: true, size: 26 })], alignment: AlignmentType.RIGHT, spacing: { before: 80, after: 160 } }),
    ...(document.payment ? [new Paragraph(`Payment: ${formatDocumentCurrency(document.payment.amount, document.currency)} via ${document.payment.method.replaceAll("_", " ")} on ${document.payment.paidAt.toLocaleDateString("en")}`)] : []),
    ...(documentTerms(document) ? [new Paragraph({ text: "Terms", heading: HeadingLevel.HEADING_3, spacing: { before: 280 } }), new Paragraph(documentTerms(document))] : []),
    ...(document.company.documents?.footer ? [new Paragraph({ text: document.company.documents.footer, spacing: { before: 300 } })] : []),
    new Paragraph({ text: "Generated from the Veteran Power Solutions Limited staff portal. Confirm company, tax, currency, and legal details before external use.", spacing: { before: 300 } }),
  ];

  const watermark = getWatermark();
  const watermarkData = Uint8Array.from(watermark);
  const watermarkHeader = new Header({
    children: [new Paragraph({ children: [new ImageRun({
      type: "png",
      data: watermarkData.buffer as ArrayBuffer,
      transformation: { width: 520, height: 186 },
      floating: {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 1302000 },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 4458000 },
        behindDocument: true,
        allowOverlap: true,
        wrap: { type: TextWrappingType.NONE },
      },
    })] })],
  });
  return Packer.toBuffer(new WordDocument({ sections: [{ headers: { default: watermarkHeader }, children: section }] }));
}

async function createSpreadsheet(document: ExportDocument) {
  const workbook = new ExcelJS.Workbook();
  const watermarkId = workbook.addImage({ base64: getWatermark().toString("base64"), extension: "png" });
  const schoolLogo = institutionLogo(document);
  const schoolLogoId = schoolLogo ? workbook.addImage({ base64: schoolLogo.url.slice(schoolLogo.url.indexOf(",") + 1), extension: schoolLogo.mimeType === "image/png" ? "png" : "jpeg" }) : null;
  workbook.creator = document.company.profile?.name ?? "Veteran Power Solutions Limited";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Document", { views: [{ state: "frozen", ySplit: 9 }] });
  sheet.columns = [
    { header: "Description", key: "description", width: 42 },
    { header: "Quantity", key: "quantity", width: 14 },
    { header: `Unit price (${document.currency})`, key: "unitPrice", width: 18 },
    { header: `Discount (${document.currency})`, key: "discount", width: 16 },
    { header: "Tax rate (%)", key: "taxRate", width: 15 },
    { header: `Tax amount (${document.currency})`, key: "taxAmount", width: 18 },
    { header: `Line total (${document.currency})`, key: "total", width: 18 },
  ];
  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = document.company.profile?.name ?? "Company details to be confirmed";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF202A27" } };
  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = documentTitle(document);
  sheet.getCell("A2").font = { bold: true, size: 14 };
  if (schoolLogoId !== null) sheet.addImage(schoolLogoId, "F1:G2");
  sheet.addRow(["Status", documentStatus(document), "Date", document.createdAt, "Currency", document.currency]);
  sheet.addRow(["Customer", document.customer.company || document.customer.name, "Email", document.customer.email ?? ""]);
  sheet.addRow(["Phone", document.customer.phone ?? "", "Address", document.customer.address ?? ""]);
  if (document.company.profile?.taxInformation) sheet.addRow(["Company tax information", document.company.profile.taxInformation]);
  relatedDocumentLines(document).forEach((line) => sheet.addRow(["Related document", line]));
  sheet.addRow([]);
  const headerRow = sheet.addRow(sheet.columns.map((column) => column.header));
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF24433A" } };
  const cellGrid = {
    top: { style: "thin" as const, color: { argb: "FFB9C3BC" } },
    bottom: { style: "thin" as const, color: { argb: "FFB9C3BC" } },
    left: { style: "thin" as const, color: { argb: "FFB9C3BC" } },
    right: { style: "thin" as const, color: { argb: "FFB9C3BC" } },
  };
  headerRow.eachCell({ includeEmpty: true }, (cell) => { cell.border = cellGrid; });
  for (const item of document.items) {
    const row = sheet.addRow({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate, taxAmount: item.taxAmount, total: item.total });
    row.eachCell({ includeEmpty: true }, (cell) => { cell.border = cellGrid; });
  }
  sheet.addRow([]);
  sheet.addRow([`Subtotal (${document.currency})`, document.subtotal]);
  sheet.addRow([`Tax (${document.currency})`, document.tax]);
  sheet.addRow([`Total (${document.currency})`, document.total]);
  if (documentTerms(document)) {
    sheet.addRow([]);
    sheet.addRow(["Terms", documentTerms(document)]);
    if (sheet.lastRow) sheet.lastRow.alignment = { wrapText: true, vertical: "top" };
  }
  for (const row of sheet.getRows(1, sheet.rowCount) ?? []) {
    for (let column = 2; column <= 7; column += 1) row.getCell(column).numFmt = "#,##0.00;[Red]-#,##0.00";
  }
  sheet.getColumn(4).numFmt = "0.##";
  sheet.getColumn(5).numFmt = "0.##";
  const finalRow = sheet.lastRow;
  if (finalRow) finalRow.font = { bold: true, size: 12 };
  sheet.addImage(watermarkId, `A6:G${Math.min(Math.max(sheet.rowCount, 16), 23)}`);
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

async function createPdf(document: ExportDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 48, info: { Title: documentTitle(document), Author: document.company.profile?.name ?? "Veteran Power Solutions Limited" } });
    const schoolLogo = institutionLogo(document);
    const watermark = getWatermark();
    const drawWatermark = () => {
      pdf.save().opacity(1).image(watermark, 66, 338, { fit: [463, 166], align: "center", valign: "center" }).restore();
    };
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.on("pageAdded", drawWatermark);
    drawWatermark();

    const left = 48;
    const right = 547;
    const pageBottom = 780;
    const ensureSpace = (height: number) => { if (pdf.y + height > pageBottom) pdf.addPage(); };
    pdf.fillColor("#24433a").font("Helvetica-Bold").fontSize(17).text(document.company.profile?.name ?? "Company details to be confirmed", left);
    pdf.fillColor("#68716c").font("Helvetica").fontSize(9);
    if (document.company.profile?.address) pdf.text(document.company.profile.address);
    const contact = [document.company.profile?.email, document.company.profile?.phone].filter(Boolean).join(" · ");
    if (contact) pdf.text(contact);
    if (document.company.profile?.taxInformation) pdf.text(`Tax information: ${document.company.profile.taxInformation}`);
    if (schoolLogo) pdf.image(Buffer.from(logoBytes(schoolLogo.url)), 408, 42, { fit: [138, 72], align: "center", valign: "center" });
    pdf.moveDown(1.6).fillColor("#202a27").font("Helvetica-Bold").fontSize(24).text(documentTitle(document));
    pdf.moveDown(0.5).font("Helvetica").fontSize(10).fillColor("#68716c").text(`Status: ${documentStatus(document)}     Currency: ${document.currency}     Date: ${document.createdAt.toLocaleDateString("en")}`);
    pdf.moveDown(1.4).fillColor("#202a27").font("Helvetica-Bold").fontSize(11).text("Bill to");
    pdf.font("Helvetica").fontSize(10).text(document.customer.company || document.customer.name);
    if (document.customer.company && document.customer.name) pdf.text(document.customer.name);
    for (const detail of [document.customer.address, document.customer.email, document.customer.phone]) if (detail) pdf.text(detail);
    relatedDocumentLines(document).forEach((line) => pdf.text(line));
    pdf.moveDown(1.2);

    const tableWidth = right - left;
    const columns = [
      { title: "DESCRIPTION", x: left, width: 178, align: "left" as const },
      { title: "QTY", x: 226, width: 44, align: "right" as const },
      { title: `UNIT (${document.currency})`, x: 270, width: 70, align: "right" as const },
      { title: `DISCOUNT (${document.currency})`, x: 340, width: 70, align: "right" as const },
      { title: `TAX (${document.currency})`, x: 410, width: 68, align: "right" as const },
      { title: `TOTAL (${document.currency})`, x: 478, width: right - 478, align: "right" as const },
    ];
    const columnEdges = [left, ...columns.slice(1).map((column) => column.x), right];
    const drawGrid = (y: number, height: number) => {
      pdf.save().lineWidth(0.6).strokeColor("#b9c3bc").rect(left, y, tableWidth, height).stroke();
      for (const edge of columnEdges.slice(1, -1)) pdf.moveTo(edge, y).lineTo(edge, y + height).stroke();
      pdf.restore();
    };
    const headerHeight = 26;
    const drawHeader = () => {
      const y = pdf.y;
      pdf.save().fillColor("#24433a").rect(left, y, tableWidth, headerHeight).fill();
      pdf.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7);
      for (const column of columns) pdf.text(column.title, column.x + 5, y + 8, { width: column.width - 10, align: column.align, lineBreak: false, ellipsis: true });
      drawGrid(y, headerHeight);
      pdf.restore();
      pdf.y = y + headerHeight;
    };
    drawHeader();
    for (let index = 0; index < document.items.length; index += 1) {
      const item = document.items[index];
      const descriptionHeight = pdf.heightOfString(item.description, { width: columns[0].width - 12 });
      const rowHeight = Math.max(28, descriptionHeight + 12);
      if (pdf.y + rowHeight > pageBottom) {
        pdf.addPage();
        drawHeader();
      }
      const y = pdf.y;
      if (index % 2 === 1) pdf.save().fillColor("#f7f9f7").rect(left, y, tableWidth, rowHeight).fill().restore();
      pdf.font("Helvetica").fontSize(9).fillColor("#202a27");
      const values = [
        item.description,
        formatDocumentNumber(item.quantity),
        formatDocumentNumber(item.unitPrice),
        formatDocumentNumber(item.discount),
        formatDocumentNumber(item.taxAmount),
        formatDocumentNumber(item.total),
      ];
      columns.forEach((column, columnIndex) => pdf.text(values[columnIndex], column.x + 5, y + 6, { width: column.width - 10, align: column.align }));
      drawGrid(y, rowHeight);
      pdf.y = y + rowHeight;
    }

    ensureSpace(95);
    pdf.moveDown(0.5).font("Helvetica").fontSize(10).fillColor("#68716c");
    pdf.text(`Subtotal (${document.currency}): ${formatDocumentNumber(document.subtotal)}`, left, pdf.y, { width: right - left, align: "right" });
    pdf.text(`Tax (${document.currency}): ${formatDocumentNumber(document.tax)}`, left, pdf.y + 16, { width: right - left, align: "right" });
    pdf.font("Helvetica-Bold").fontSize(14).fillColor("#202a27").text(`Total (${document.currency}): ${formatDocumentNumber(document.total)}`, left, pdf.y + 34, { width: right - left, align: "right" });
    pdf.moveDown(4);
    if (document.payment) pdf.font("Helvetica").fontSize(9).fillColor("#68716c").text(`Payment: ${formatDocumentCurrency(document.payment.amount, document.currency)} via ${document.payment.method.replaceAll("_", " ")} on ${document.payment.paidAt.toLocaleDateString("en")}`);
    if (documentTerms(document)) pdf.moveDown().font("Helvetica-Bold").text("Terms").font("Helvetica").text(documentTerms(document));
    if (document.company.documents?.footer) pdf.moveDown().text(document.company.documents.footer);
    pdf.moveDown().fontSize(8).fillColor("#68716c").text("Generated from the Veteran Power Solutions Limited staff portal. Confirm company, tax, currency, and legal details before external use.");
    pdf.end();
  });
}

export async function buildDocumentExport(document: ExportDocument, format: ExportFormat) {
  if (format === "docx") return createWordDocument(document);
  if (format === "xlsx") return createSpreadsheet(document);
  return createPdf(document);
}
