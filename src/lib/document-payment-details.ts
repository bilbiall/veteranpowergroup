import "server-only";

export const documentPaymentDetails = [
  { label: "Paybill Business No.", value: process.env.DOCUMENT_PAYBILL_BUSINESS_NO?.trim() || "529914", breakBefore: false },
  { label: "Paybill Account No.", value: process.env.DOCUMENT_PAYBILL_ACCOUNT_NO?.trim() || "14970", breakBefore: false },
  { label: process.env.DOCUMENT_BANK_NAME?.trim() || "Kingdom Bank", value: process.env.DOCUMENT_BANK_ACCOUNT_NO?.trim() || "0011 895 870 002", breakBefore: true },
  { label: "Branch", value: process.env.DOCUMENT_BANK_BRANCH?.trim() || "Koinange Branch", breakBefore: false },
] as const;

export const visibleDocumentPaymentDetails = documentPaymentDetails.filter((detail) => detail.value);

export const companyKraPin = process.env.COMPANY_KRA_PIN?.trim() || "P052149757Z";
