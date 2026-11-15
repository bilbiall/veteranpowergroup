import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getPrototypeSession, getStaffAccess } from "@/lib/prototype-auth";
import type { StaffAccessKey } from "@/lib/staff-sections";

export const runtime = "nodejs";

type Dataset = "summary" | "findings" | "analytics" | "prospects" | "receipts" | "quotations" | "invoices" | "audit-trail";
type Row = Record<string, string | number | Date | boolean | null>;
const permissions: Record<Dataset, string> = {
  summary: "report-summary", findings: "report-findings", analytics: "report-analytics", prospects: "report-prospects",
  receipts: "report-receipts", quotations: "report-quotations", invoices: "report-invoices", "audit-trail": "report-audit-trail",
};

function parseLocalDateTime(value: string | null, isEnd = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const [year, month, day, hour, minute] = value.split(/[T:-]/).map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day || calendarCheck.getUTCHours() !== hour || calendarCheck.getUTCMinutes() !== minute) return null;
  const date = new Date(`${value}:00+03:00`);
  if (!Number.isFinite(date.getTime())) return null;
  if (isEnd) date.setTime(date.getTime() + 60_000);
  return date;
}

function addSheet(workbook: ExcelJS.Workbook, name: string, rows: Row[]) {
  const sheet = workbook.addWorksheet(name);
  if (!rows.length) rows = [{ Message: "No records in the selected period" }];
  const columns = Object.keys(rows[0]);
  sheet.columns = columns.map((key) => ({ header: key, key, width: Math.min(Math.max(key.length + 4, 16), 46) }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF087A45" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const session = await getPrototypeSession();
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });
  const access = await getStaffAccess(session.userId);
  const { dataset: rawDataset } = await params;
  if (!(rawDataset in permissions)) return Response.json({ error: "Unknown export type" }, { status: 404 });
  const dataset = rawDataset as Dataset;
  if (!access.sections.includes("reports") || !access.sections.includes(permissions[dataset] as StaffAccessKey)) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = parseLocalDateTime(url.searchParams.get("from"));
  const to = parseLocalDateTime(url.searchParams.get("to"), true);
  if (!from || !to || from >= to) return Response.json({ error: "Choose a valid start and end date and time" }, { status: 400 });
  const dateRange = { gte: from, lt: to };
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Veteran Power Solutions Limited";
  workbook.created = new Date();

  if (dataset === "summary") {
    const [prospects, documents, visits] = await Promise.all([
      prisma.prospect.count({ where: { createdAt: dateRange } }),
      prisma.document.groupBy({ by: ["type", "currency"], where: { createdAt: dateRange }, _count: { _all: true }, _sum: { total: true } }),
      prisma.websiteVisit.count({ where: { visitedAt: dateRange } }),
    ]);
    const rangeLabel = `${from.toLocaleString("en-KE")} – ${new Date(to.getTime() - 60_000).toLocaleString("en-KE")}`;
    const rows: Row[] = [
      { Period: rangeLabel, Item: "Website page views", Value: visits, Currency: "", Count: "", Total: "" },
      { Period: "", Item: "Prospects", Value: prospects, Currency: "", Count: "", Total: "" },
      ...(["RECEIPT", "QUOTATION", "INVOICE"] as const).flatMap((type) => (["KES", "USD"] as const).map((currency) => {
        const group = documents.find((entry) => entry.type === type && entry.currency === currency);
        return { Period: "", Item: `${type[0]}${type.slice(1).toLowerCase()}s`, Value: "", Currency: currency, Count: group?._count._all ?? 0, Total: group?._sum.total ?? 0 };
      })),
    ];
    addSheet(workbook, "Reports", rows);
  } else if (dataset === "findings") {
    const findings = await prisma.finding.findMany({ where: { createdAt: dateRange }, orderBy: { createdAt: "desc" } });
    addSheet(workbook, "Findings", findings.map((entry) => ({ Title: entry.title, Details: entry.details, Priority: entry.priority, Status: entry.status, Created: entry.createdAt, Updated: entry.updatedAt })));
  } else if (dataset === "analytics") {
    const [pages, referrers] = await Promise.all([
      prisma.websiteVisit.groupBy({ by: ["path"], where: { visitedAt: dateRange }, _count: { _all: true }, orderBy: { path: "asc" } }),
      prisma.websiteVisit.groupBy({ by: ["referrer"], where: { visitedAt: dateRange }, _count: { _all: true }, orderBy: { referrer: "asc" } }),
    ]);
    addSheet(workbook, "Analytics", Array.from({ length: Math.max(pages.length, referrers.length) }, (_, i) => ({ Page: pages[i]?.path ?? "", "Page views": pages[i]?._count._all ?? "", Referrer: referrers[i]?.referrer ?? "Direct / unknown", "Referrer views": referrers[i]?._count._all ?? "" })));
  } else if (dataset === "prospects") {
    const prospects = await prisma.prospect.findMany({ where: { createdAt: dateRange }, orderBy: { createdAt: "desc" } });
    addSheet(workbook, "Prospects", prospects.map((entry) => ({ Name: entry.name, Email: entry.email ?? "", Phone: entry.phone ?? "", Company: entry.company ?? "", "Interested in": entry.serviceInterest ?? "", Message: entry.message, Status: entry.status, Received: entry.createdAt })));
  } else if (dataset === "audit-trail") {
    const logs = await prisma.auditLog.findMany({ where: { createdAt: dateRange }, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true, email: true } } } });
    addSheet(workbook, "Audit trail", logs.map((entry) => ({ Time: entry.createdAt, Staff: entry.actor?.name ?? entry.actor?.email ?? "Former account", Email: entry.actor?.email ?? "", Action: entry.action, Record: `${entry.entityType} ${entry.entityId}`, Changes: entry.summary })));
  } else {
    const type = dataset === "receipts" ? "RECEIPT" : dataset === "quotations" ? "QUOTATION" : "INVOICE";
    const records = await prisma.document.findMany({ where: { type, createdAt: dateRange }, include: { customer: true, items: { orderBy: { sortOrder: "asc" } }, payment: true }, orderBy: { createdAt: "desc" } });
    addSheet(workbook, dataset[0].toUpperCase() + dataset.slice(1), records.map((entry) => ({
      Number: entry.number, Customer: entry.customer.name, Company: entry.customer.company ?? "", Currency: entry.currency,
      "Customer contact": [entry.customer.email, entry.customer.phone].filter(Boolean).join(" · "),
      Status: entry.quotationStatus ?? entry.invoiceStatus ?? entry.receiptStatus ?? "—",
      "Line items": entry.items.map((item) => `${item.description} × ${item.quantity}`).join("; "),
      Subtotal: entry.subtotal, Tax: entry.tax, Total: entry.total,
      "Payment amount": entry.payment?.amount ?? "", "Payment method": entry.payment?.method ?? "", Created: entry.createdAt,
    })));
  }

  const content = await workbook.xlsx.writeBuffer();
  const filename = `veteran-${dataset}-${from.toISOString().slice(0, 10)}-to-${new Date(to.getTime() - 60_000).toISOString().slice(0, 10)}.xlsx`;
  return new Response(Uint8Array.from(content as unknown as ArrayLike<number>), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(content.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
