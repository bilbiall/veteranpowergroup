export const documentPaymentDetails = [
  { label: "Paybill Business No.", value: process.env.DOCUMENT_PAYBILL_BUSINESS_NO ?? "" },
  { label: "Paybill Account No.", value: process.env.DOCUMENT_PAYBILL_ACCOUNT_NO ?? "" },
  { label: process.env.DOCUMENT_BANK_NAME ?? "Bank", value: process.env.DOCUMENT_BANK_ACCOUNT_NO ?? "" },
  { label: "Branch", value: process.env.DOCUMENT_BANK_BRANCH ?? "" },
] as const;

export const visibleDocumentPaymentDetails = documentPaymentDetails.filter((detail) => detail.value);

export const companyKraPin = process.env.COMPANY_KRA_PIN ?? "";
