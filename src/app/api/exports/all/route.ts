import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getPrototypeSession } from "@/lib/prototype-auth";

export const runtime = "nodejs";

type ExportRow = Record<string, string | number | Date | boolean | null>;

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: string[], rows: ExportRow[]) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((key) => ({ header: key, key, width: Math.min(Math.max(key.length + 4, 16), 42) }));
  for (const row of rows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF087A45" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

export async function GET() {
  const session = await getPrototypeSession();
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });

  const [prospects, findings, documents, pageViews, referralViews, totalViews] = await Promise.all([
    prisma.prospect.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.finding.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.document.findMany({ where: { type: { in: ["RECEIPT", "QUOTATION", "INVOICE"] } }, include: { customer: true, items: { orderBy: { sortOrder: "asc" } }, payment: true }, orderBy: { createdAt: "desc" } }),
    prisma.websiteVisit.groupBy({ by: ["path"], _count: { _all: true }, orderBy: { path: "asc" } }),
    prisma.websiteVisit.groupBy({ by: ["referrer"], _count: { _all: true }, orderBy: { referrer: "asc" } }),
    prisma.websiteVisit.count(),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Veteran Power Solutions Limited";
  workbook.created = new Date();
  const byType = (type: "QUOTATION" | "INVOICE" | "RECEIPT") => documents.filter((document) => document.type === type);
  const quotations = byType("QUOTATION");
  const invoices = byType("INVOICE");
  const receipts = byType("RECEIPT");
  const currencyTotal = (records: typeof documents, currency: "KES" | "USD") => records.filter((document) => document.currency === currency).reduce((sum, document) => sum + document.total, 0);

  addSheet(workbook, "Reports", ["Generated at", "Website page views", "Prospects", "Open findings", "Quotations", "Quotation value (KES)", "Quotation value (USD)", "Invoices", "Invoice value (KES)", "Invoice value (USD)", "Receipts", "Receipt value (KES)", "Receipt value (USD)"], [{
    "Generated at": new Date(),
    "Website page views": totalViews,
    Prospects: prospects.length,
    "Open findings": findings.filter((finding) => finding.status !== "RESOLVED").length,
    Quotations: quotations.length,
    "Quotation value (KES)": currencyTotal(quotations, "KES"),
    "Quotation value (USD)": currencyTotal(quotations, "USD"),
    Invoices: invoices.length,
    "Invoice value (KES)": currencyTotal(invoices, "KES"),
    "Invoice value (USD)": currencyTotal(invoices, "USD"),
    Receipts: receipts.length,
    "Receipt value (KES)": currencyTotal(receipts, "KES"),
    "Receipt value (USD)": currencyTotal(receipts, "USD"),
  }]);
  addSheet(workbook, "Findings", ["Title", "Details", "Priority", "Status", "Created"], findings.map((finding) => ({ Title: finding.title, Details: finding.details, Priority: finding.priority, Status: finding.status, Created: finding.createdAt })));
  addSheet(workbook, "Analytics", ["Page", "Page views", "Referrer", "Referrer views"], Array.from({ length: Math.max(pageViews.length, referralViews.length) }, (_, index) => ({
    Page: pageViews[index]?.path ?? "",
    "Page views": pageViews[index]?._count._all ?? "",
    Referrer: referralViews[index]?.referrer ?? "Direct / unknown",
    "Referrer views": referralViews[index]?._count._all ?? "",
  })));
  addSheet(workbook, "Prospects", ["Name", "Email", "Phone", "Company", "Interested in", "Message", "Status", "Received"], prospects.map((prospect) => ({ Name: prospect.name, Email: prospect.email ?? "", Phone: prospect.phone ?? "", Company: prospect.company ?? "", "Interested in": prospect.serviceInterest ?? "", Message: prospect.message, Status: prospect.status, Received: prospect.createdAt })));

  const documentRows = (records: typeof documents): ExportRow[] => records.map((document) => ({
    Number: document.number,
    Customer: document.customer.company || document.customer.name,
    Currency: document.currency,
    "Customer contact": [document.customer.email, document.customer.phone].filter(Boolean).join(" · "),
    Status: document.quotationStatus ?? document.invoiceStatus ?? document.receiptStatus ?? "Draft",
    "Line items": document.items.map((item) => `${item.description} × ${item.quantity}`).join("; "),
    Subtotal: document.subtotal,
    Tax: document.tax,
    Total: document.total,
    "Payment amount": document.payment?.amount ?? "",
    "Payment method": document.payment?.method ?? "",
    Created: document.createdAt,
  }));
  const documentColumns = ["Number", "Customer", "Currency", "Customer contact", "Status", "Line items", "Subtotal", "Tax", "Total", "Payment amount", "Payment method", "Created"];
  addSheet(workbook, "Receipts", documentColumns, documentRows(receipts));
  addSheet(workbook, "Quotations", documentColumns, documentRows(quotations));
  addSheet(workbook, "Invoices", documentColumns, documentRows(invoices));

  const content = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(Uint8Array.from(content as unknown as ArrayLike<number>), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="veteran-all-data-${date}.xlsx"`,
      "Content-Length": String(content.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
