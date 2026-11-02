export const defaultWhatsappMessage = "Hello Veteran Power Solutions, I would like to enquire about your solutions.";
export const defaultWhatsappNumber = "254707734670";

// Accepts "0707 734 670", "+254 707 734 670" or "254707734670"; returns digits only in international format.
export function normalizeWhatsappNumber(input: string) {
  const digits = input.replace(/\D/g, "");
  const international = digits.startsWith("0") ? `254${digits.slice(1)}` : digits;
  return /^\d{9,15}$/.test(international) ? international : null;
}

export function whatsappLink(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
