import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const exportDocumentInclude = {
  customer: true,
  company: { include: { profile: true, documents: true } },
  items: { orderBy: { sortOrder: "asc" } },
  sourceDocument: true,
  payment: true,
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
