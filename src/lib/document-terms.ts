import type { ExportDocument } from "@/lib/document-export-data";

export const QUOTATION_INVOICE_TERMS = "Quotation valid while stocks last.\nQuote can be reviewed after 30 days";
export const RECEIPT_TERMS = "Goods once bought can never be returned";
export const RECEIPT_WARRANTY_HEADING = "Warranty";

export function defaultTermsForDocument(type: ExportDocument["type"]) {
  return type === "RECEIPT" ? RECEIPT_TERMS : QUOTATION_INVOICE_TERMS;
}

export function resolveDocumentTerms(document: Pick<ExportDocument, "type" | "terms">) {
  const savedTerms = document.terms?.trim();
  const legacyPlaceholder = "Prototype terms — replace before use.";
  if (savedTerms && savedTerms !== legacyPlaceholder) return savedTerms;
  return defaultTermsForDocument(document.type);
}
