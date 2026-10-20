import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const exportDocumentInclude = {
  customer: { include: { media: { where: { caption: "Institution logo on school solution documents" }, select: { id: true, filename: true, url: true, mimeType: true, altText: true, title: true } } } },
  company: { include: { profile: true, documents: true } },
  items: { orderBy: { sortOrder: "asc" } },
  sourceDocument: { include: {
    sourceDocument: { select: { id: true, number: true, type: true } },
    payments: { select: { id: true, amount: true, method: true, paidAt: true, receiptId: true }, orderBy: [{ paidAt: "asc" }, { id: "asc" }] },
  } },
  payment: true,
  payments: { include: { receipt: { select: { id: true, number: true, receiptStatus: true } } }, orderBy: { paidAt: "asc" } },
  derivedDocuments: { select: { id: true, number: true, type: true, invoiceStatus: true, receiptStatus: true, total: true, createdAt: true }, orderBy: { createdAt: "asc" } },
  media: { select: { id: true, filename: true, url: true, mimeType: true, altText: true, title: true } },
} satisfies Prisma.DocumentInclude;

export type ExportDocument = Prisma.DocumentGetPayload<{ include: typeof exportDocumentInclude }>;

export function documentTypeLabel(type: ExportDocument["type"]) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export function documentStatus(document: ExportDocument) {
  return document.quotationStatus ?? document.invoiceStatus ?? document.receiptStatus ?? "Draft";
}

export async function findExportDocument(id: string) {
  return prisma.document.findUnique({ where: { id }, include: exportDocumentInclude });
}

export function formatDocumentNumber(value: number) {
  return value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDocumentCurrency(value: number, currency: "KES" | "USD") {
  return `${currency} ${formatDocumentNumber(value)}`;
}

export function receiptPaymentSummary(document: ExportDocument) {
  if (document.type !== "RECEIPT" || !document.payment || !document.sourceDocument) return null;
  const payments = document.sourceDocument.payments;
  const paymentIndex = payments.findIndex((payment) => payment.receiptId === document.id);
  if (paymentIndex < 0) return null;
  const paidAtReceipt = payments.slice(0, paymentIndex + 1).reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, Math.round((document.sourceDocument.total - paidAtReceipt) * 100) / 100);
  return { paidAtReceipt, remaining, kind: remaining <= 0.005 ? "Full payment" : "Partial payment" } as const;
}
