import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import {
  AlignmentType,
  Document as WordDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  documentStatus,
  documentTypeLabel,
  type ExportDocument,
  formatDocumentNumber,
} from "@/lib/document-export-data";

export type ExportFormat = "docx" | "xlsx" | "pdf";

function documentTitle(document: ExportDocument) {
  return `${documentTypeLabel(document.type)} ${document.number}`;
}

function wordCell(value: string, bold = false) {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, bold, size: 18 })] })] });
}

async function createWordDocument(document: ExportDocument) {
  const company = document.company.profile;
  const companyContact = [company?.email, company?.phone].filter((value): value is string => Boolean(value));
  const rows = [
    new TableRow({ children: ["Description", "Qty", "Unit price", "Discount", "Tax", "Total"].map((value) => wordCell(value, true)) }),
    ...document.items.map((item) => new TableRow({ children: [
      wordCell(item.description),
      wordCell(formatDocumentNumber(item.quantity)),
      wordCell(formatDocumentNumber(item.unitPrice)),
      wordCell(formatDocumentNumber(item.discount)),
      wordCell(formatDocumentNumber(item.taxAmount)),
      wordCell(formatDocumentNumber(item.total)),
    ] })),
  ];
  const section = [
    new Paragraph({ text: company?.name ?? "Company details to be confirmed", heading: HeadingLevel.HEADING_2 }),
    ...(company?.address ? [new Paragraph(company.address)] : []),
    ...(companyContact.length ? [new Paragraph(companyContact.join(" · "))] : []),
    ...(company?.taxInformation ? [new Paragraph(`Tax information: ${company.taxInformation}`)] : []),
    new Paragraph({ text: documentTitle(document), heading: HeadingLevel.TITLE, spacing: { before: 280, after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: `Status: ${documentStatus(document)}`, bold: true }), new TextRun(`    Date: ${document.createdAt.toLocaleDateString("en")}`)] }),
    new Paragraph({ text: "Bill to", heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: document.customer.company || document.customer.name, bold: true })] }),
    ...(document.customer.company && document.customer.name ? [new Paragraph(document.customer.name)] : []),
    ...([document.customer.address, document.customer.email, document.customer.phone].filter(Boolean).map((value) => new Paragraph(value!))),
    ...(document.sourceDocument ? [new Paragraph({ children: [new TextRun({ text: "Related invoice: ", bold: true }), new TextRun(document.sourceDocument.number)] })] : []),
    new Paragraph({ text: "Items", heading: HeadingLevel.HEADING_3, spacing: { before: 260, after: 100 } }),
    new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({ text: `Subtotal: ${formatDocumentNumber(document.subtotal)}`, alignment: AlignmentType.RIGHT, spacing: { before: 200 } }),
    new Paragraph({ text: `Tax: ${formatDocumentNumber(document.tax)}`, alignment: AlignmentType.RIGHT }),
    new Paragraph({ children: [new TextRun({ text: `Total: ${formatDocumentNumber(document.total)}`, bold: true, size: 26 })], alignment: AlignmentType.RIGHT, spacing: { before: 80, after: 160 } }),
    ...(document.payment ? [new Paragraph(`Payment: ${formatDocumentNumber(document.payment.amount)} via ${document.payment.method.replaceAll("_", " ")} on ${document.payment.paidAt.toLocaleDateString("en")}`)] : []),
    ...(document.company.documents?.terms ? [new Paragraph({ text: "Terms", heading: HeadingLevel.HEADING_3, spacing: { before: 280 } }), new Paragraph(document.company.documents.terms)] : []),
    ...(document.company.documents?.footer ? [new Paragraph({ text: document.company.documents.footer, spacing: { before: 300 } })] : []),
    new Paragraph({ text: "Generated from the Northstar prototype. Confirm company, tax, currency, and legal details before external use.", spacing: { before: 300 } }),
  ];

  return Packer.toBuffer(new WordDocument({ sections: [{ children: section }] }));
}

async function createSpreadsheet(document: ExportDocument) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = document.company.profile?.name ?? "Northstar prototype";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Document", { views: [{ state: "frozen", ySplit: 9 }] });
  sheet.columns = [
    { header: "Description", key: "description", width: 42 },
    { header: "Quantity", key: "quantity", width: 14 },
    { header: "Unit price", key: "unitPrice", width: 18 },
    { header: "Discount", key: "discount", width: 16 },
    { header: "Tax rate (%)", key: "taxRate", width: 15 },
    { header: "Tax amount", key: "taxAmount", width: 18 },
    { header: "Line total", key: "total", width: 18 },
  ];
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = document.company.profile?.name ?? "Company details to be confirmed";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF202A27" } };
  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = documentTitle(document);
  sheet.getCell("A2").font = { bold: true, size: 14 };
  sheet.addRow(["Status", documentStatus(document), "Date", document.createdAt]);
  sheet.addRow(["Customer", document.customer.company || document.customer.name, "Email", document.customer.email ?? ""]);
  sheet.addRow(["Phone", document.customer.phone ?? "", "Address", document.customer.address ?? ""]);
  if (document.company.profile?.taxInformation) sheet.addRow(["Company tax information", document.company.profile.taxInformation]);
  if (document.sourceDocument) sheet.addRow(["Related invoice", document.sourceDocument.number]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(sheet.columns.map((column) => column.header));
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF24433A" } };
  for (const item of document.items) {
    sheet.addRow({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate, taxAmount: item.taxAmount, total: item.total });
  }
  sheet.addRow([]);
  sheet.addRow(["Subtotal", document.subtotal]);
  sheet.addRow(["Tax", document.tax]);
  sheet.addRow(["Total", document.total]);
  for (const row of sheet.getRows(1, sheet.rowCount) ?? []) {
    for (let column = 2; column <= 7; column += 1) row.getCell(column).numFmt = "#,##0.00;[Red]-#,##0.00";
  }
  sheet.getColumn(4).numFmt = "0.##";
  sheet.getColumn(5).numFmt = "0.##";
  const finalRow = sheet.lastRow;
  if (finalRow) finalRow.font = { bold: true, size: 12 };
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

async function createPdf(document: ExportDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 48, info: { Title: documentTitle(document), Author: document.company.profile?.name ?? "Northstar prototype" } });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

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
    pdf.moveDown(1.6).fillColor("#202a27").font("Helvetica-Bold").fontSize(24).text(documentTitle(document));
    pdf.moveDown(0.5).font("Helvetica").fontSize(10).fillColor("#68716c").text(`Status: ${documentStatus(document)}     Date: ${document.createdAt.toLocaleDateString("en")}`);
    pdf.moveDown(1.4).fillColor("#202a27").font("Helvetica-Bold").fontSize(11).text("Bill to");
    pdf.font("Helvetica").fontSize(10).text(document.customer.company || document.customer.name);
    if (document.customer.company && document.customer.name) pdf.text(document.customer.name);
    for (const detail of [document.customer.address, document.customer.email, document.customer.phone]) if (detail) pdf.text(detail);
    if (document.sourceDocument) pdf.text(`Related invoice: ${document.sourceDocument.number}`);
    pdf.moveDown(1.2);

    const drawHeader = () => {
      pdf.fillColor("#24433a").font("Helvetica-Bold").fontSize(8);
      const y = pdf.y;
      pdf.text("DESCRIPTION", left, y, { width: 180 });
      pdf.text("QTY", 236, y, { width: 35, align: "right" });
      pdf.text("UNIT", 277, y, { width: 55, align: "right" });
      pdf.text("DISCOUNT", 338, y, { width: 55, align: "right" });
      pdf.text("TAX", 400, y, { width: 55, align: "right" });
      pdf.text("TOTAL", 465, y, { width: 82, align: "right" });
      pdf.moveTo(left, pdf.y + 5).lineTo(right, pdf.y + 5).strokeColor("#d9ddd6").stroke();
      pdf.moveDown(0.7);
    };
    drawHeader();
    pdf.font("Helvetica").fontSize(9).fillColor("#202a27");
    for (const item of document.items) {
      const descriptionHeight = pdf.heightOfString(item.description, { width: 180 });
      ensureSpace(Math.max(descriptionHeight, 14) + 10);
      const y = pdf.y;
      pdf.text(item.description, left, y, { width: 180 });
      pdf.text(formatDocumentNumber(item.quantity), 236, y, { width: 35, align: "right" });
      pdf.text(formatDocumentNumber(item.unitPrice), 277, y, { width: 55, align: "right" });
      pdf.text(formatDocumentNumber(item.discount), 338, y, { width: 55, align: "right" });
      pdf.text(formatDocumentNumber(item.taxAmount), 400, y, { width: 55, align: "right" });
      pdf.text(formatDocumentNumber(item.total), 465, y, { width: 82, align: "right" });
      pdf.y = y + Math.max(descriptionHeight, 12) + 9;
      pdf.moveTo(left, pdf.y).lineTo(right, pdf.y).strokeColor("#edf0ec").stroke();
      pdf.moveDown(0.5);
    }

    ensureSpace(95);
    pdf.moveDown(0.5).font("Helvetica").fontSize(10).fillColor("#68716c");
    pdf.text(`Subtotal: ${formatDocumentNumber(document.subtotal)}`, left, pdf.y, { width: right - left, align: "right" });
    pdf.text(`Tax: ${formatDocumentNumber(document.tax)}`, left, pdf.y + 16, { width: right - left, align: "right" });
    pdf.font("Helvetica-Bold").fontSize(14).fillColor("#202a27").text(`Total: ${formatDocumentNumber(document.total)}`, left, pdf.y + 34, { width: right - left, align: "right" });
    pdf.moveDown(4);
    if (document.payment) pdf.font("Helvetica").fontSize(9).fillColor("#68716c").text(`Payment: ${formatDocumentNumber(document.payment.amount)} via ${document.payment.method.replaceAll("_", " ")} on ${document.payment.paidAt.toLocaleDateString("en")}`);
    if (document.company.documents?.terms) pdf.moveDown().text(`Terms: ${document.company.documents.terms}`);
    if (document.company.documents?.footer) pdf.moveDown().text(document.company.documents.footer);
    pdf.moveDown().fontSize(8).fillColor("#68716c").text("Generated from the Northstar prototype. Confirm company, tax, currency, and legal details before external use.");
    pdf.end();
  });
}

export async function buildDocumentExport(document: ExportDocument, format: ExportFormat) {
  if (format === "docx") return createWordDocument(document);
  if (format === "xlsx") return createSpreadsheet(document);
  return createPdf(document);
}
