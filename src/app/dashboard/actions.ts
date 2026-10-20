"use server";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import sharp from "sharp";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashStaffPassword, requirePrototypeAdminSession, requirePrototypeSession } from "@/lib/prototype-auth";
import { getSchoolPaymentPlan } from "@/lib/school-payment-plans";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";

const staffAccountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
});

const staffStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "DISABLED"]),
});

const staffPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(12).max(128),
});

const staffRoleName = "Prototype staff";
const adminRoleName = "Prototype administrator";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.union([z.literal(""), z.email()]).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
});

const quotationSchema = z.object({
  customerId: z.string().min(1),
  description: z.string().trim().min(2).max(250),
  quantity: z.coerce.number().positive().max(100000),
  unitPrice: z.coerce.number().nonnegative().max(100000000),
});
const schoolPlanSchema = z.object({
  planId: z.string().min(1),
  customerName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().max(120).optional(),
  currency: z.enum(["KES", "USD"]),
  email: z.union([z.literal(""), z.email()]).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional(),
  stage1Amount: z.coerce.number().positive().max(100000000),
  stage2Amount: z.coerce.number().positive().max(100000000),
  stage3Amount: z.coerce.number().positive().max(100000000),
});
const documentIdSchema = z.object({ documentId: z.string().min(1) });
const paymentSchema = z.object({ invoiceId: z.string().min(1), amount: z.coerce.number().positive().max(100000000), method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY"]), reference: z.string().trim().max(120).optional() });
const receiptEditSchema = z.object({ documentId: z.string().min(1), amount: z.coerce.number().positive().max(100000000), method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY"]), reference: z.string().trim().max(120).optional(), description: z.string().trim().min(2).max(250) });
const documentLineSchema = z.object({ itemId: z.string().min(1), description: z.string().trim().min(2).max(250), quantity: z.coerce.number().positive().max(100000), unitPrice: z.coerce.number().nonnegative().max(100000000), discount: z.coerce.number().nonnegative().max(100000000), taxRate: z.coerce.number().nonnegative().max(100) });

async function nextDocumentNumber(tx: Prisma.TransactionClient, type: "QUOTATION" | "INVOICE" | "RECEIPT", year: number) {
  const settings = await tx.documentSettings.findUnique({ where: { companyId: 1 }, select: { quotePrefix: true, invoicePrefix: true, receiptPrefix: true } });
  const prefix = type === "QUOTATION" ? settings?.quotePrefix ?? "QUO" : type === "INVOICE" ? settings?.invoicePrefix ?? "INV" : settings?.receiptPrefix ?? "REC";
  const sequence = await tx.documentNumberSequence.upsert({
    where: { companyId_type_year: { companyId: 1, type, year } },
    create: { companyId: 1, type, year, prefix, nextValue: 2 },
    update: { nextValue: { increment: 1 }, prefix },
    select: { nextValue: true },
  });
  const sequenceValue = sequence.nextValue - 1;
  return { prefix, sequenceValue, number: `${prefix}-${year}-${String(sequenceValue).padStart(4, "0")}` };
}

const prospectStatusSchema = z.object({ id: z.string().min(1), status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"]) });
const findingSchema = z.object({
  title: z.string().trim().min(3).max(160),
  details: z.string().trim().min(5).max(3000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});
const findingStatusSchema = z.object({ id: z.string().min(1), status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]) });
const portfolioProjectSchema = z.object({
  title: z.string().trim().min(3).max(160),
  category: z.enum(["Power Solutions", "Solar Solutions", "Borehole Solutions"]),
  location: z.string().trim().max(160).optional(),
  summary: z.string().trim().min(10).max(2000),
  completionYear: z.union([z.literal(""), z.coerce.number().int().min(1980).max(2100)]).optional(),
  isPublished: z.string().optional(),
});
const portfolioProjectStatusSchema = z.object({ id: z.string().min(1), isPublished: z.enum(["true", "false"]) });

export async function createCustomer(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/customers?error=invalid");
  const actor = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!actor) redirect("/dashboard/customers?error=setup");

  const customer = await prisma.customer.create({
    data: {
      ...parsed.data,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
    },
  });
  await prisma.auditLog.create({
      data: { actorId: actor.id, action: "created", entityType: "Customer", entityId: customer.id, summary: `Created customer ${customer.name}` },
  });
  redirect("/dashboard/customers?created=1");
}

export async function createQuotation(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = quotationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/quotations?error=invalid");
  const owner = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } });
  const company = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { id: true } });
  if (!owner || !company) redirect("/dashboard/quotations?error=setup");

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: parsed.data.customerId }, select: { id: true } });
    if (!customer) return null;

    const year = new Date().getFullYear();
    const settings = await tx.documentSettings.findUnique({ where: { companyId: 1 }, select: { quotePrefix: true, defaultTaxRate: true } });
    const prefix = settings?.quotePrefix ?? "QUO";
    const sequence = await tx.documentNumberSequence.upsert({
      where: { companyId_type_year: { companyId: 1, type: "QUOTATION", year } },
      create: { companyId: 1, type: "QUOTATION", year, prefix, nextValue: 2 },
      update: { nextValue: { increment: 1 }, prefix },
      select: { nextValue: true },
    });
    const sequenceValue = sequence.nextValue - 1;
    const subtotal = Math.round(parsed.data.quantity * parsed.data.unitPrice * 100) / 100;
    const taxRate = settings?.defaultTaxRate ?? 0;
    const tax = Math.round(subtotal * taxRate) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const number = `${prefix}-${year}-${String(sequenceValue).padStart(4, "0")}`;

    return tx.document.create({
      data: {
        number, type: "QUOTATION", quotationStatus: "DRAFT", subtotal, tax, total,
        customerId: customer.id, ownerId: owner.id, companyId: 1, sequenceYear: year, sequenceValue,
        items: { create: { description: parsed.data.description, quantity: parsed.data.quantity, unitPrice: parsed.data.unitPrice, taxRate, amount: subtotal, taxAmount: tax, total } },
      },
      select: { id: true, number: true },
    });
  });

  if (!result) redirect("/dashboard/quotations?error=customer");
  await prisma.auditLog.create({
    data: { actorId: owner.id, action: "created", entityType: "Quotation", entityId: result.id, summary: `Created draft quotation ${result.number}` },
  });
  redirect("/dashboard/quotations?created=1");
}

export async function createSchoolPlanQuotation(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = schoolPlanSchema.safeParse(Object.fromEntries(formData));
  const plan = parsed.success ? getSchoolPaymentPlan(parsed.data.planId) : undefined;
  if (!parsed.success || !plan) redirect("/dashboard/payment-plans?error=invalid");
  const logo = formData.get("institutionLogo");
  let institutionLogo: { filename: string; mimeType: string; url: string; size: number } | null = null;
  if (logo instanceof File && logo.size > 0) {
    try {
      const image = await sharp(Buffer.from(await logo.arrayBuffer()), { limitInputPixels: 100_000_000 })
        .rotate()
        .resize({ width: 1800, height: 1400, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
      institutionLogo = { filename: logo.name.slice(0, 180) || "institution-logo.png", mimeType: "image/png", url: `data:image/png;base64,${image.toString("base64")}`, size: image.byteLength };
    } catch {
      redirect("/dashboard/payment-plans?error=logo");
    }
  }
  const owner = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!owner || !(await prisma.companySettings.findUnique({ where: { id: 1 }, select: { id: true } }))) redirect("/dashboard/payment-plans?error=setup");
  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { OR: [{ company: parsed.data.customerName }, { name: parsed.data.customerName }] }, select: { id: true } }) ?? await tx.customer.create({ data: { company: parsed.data.customerName, name: parsed.data.contactName || parsed.data.customerName, email: parsed.data.email || null, phone: parsed.data.phone || null, address: parsed.data.address || null }, select: { id: true } });
    if (institutionLogo) await tx.media.create({ data: { filename: institutionLogo.filename, mimeType: institutionLogo.mimeType, url: institutionLogo.url, size: institutionLogo.size, title: `${parsed.data.customerName} logo`, altText: `${parsed.data.customerName} logo`, caption: "Institution logo on school solution documents", customerId: customer.id } });
    const year = new Date().getFullYear();
    const settings = await tx.documentSettings.findUnique({ where: { companyId: 1 }, select: { defaultTaxRate: true } });
    const taxRate = settings?.defaultTaxRate ?? 0;
    const amounts = [parsed.data.stage1Amount, parsed.data.stage2Amount, parsed.data.stage3Amount].map((amount) => Math.round(amount * 100) / 100);
    const subtotal = amounts.reduce((sum, amount) => sum + amount, 0);
    const items = plan.stages.map((stage, index) => {
      const amount = amounts[index];
      const tax = Math.round(amount * taxRate) / 100;
      const stagePercent = subtotal ? Math.round((amount / subtotal) * 10000) / 100 : 0;
      return { description: `${plan.name} — Stage ${index + 1} (${stagePercent}%): ${stage.label}. ${plan.scope} Indicative budget, subject to site survey and supplier confirmation.`, quantity: 1, unitPrice: amount, amount, taxRate, taxAmount: tax, total: Math.round((amount + tax) * 100) / 100, sortOrder: index };
    });
    const tax = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const number = await nextDocumentNumber(tx, "QUOTATION", year);
    return tx.document.create({ data: { number: number.number, type: "QUOTATION", quotationStatus: "DRAFT", subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100, currency: parsed.data.currency, customerId: customer.id, ownerId: owner.id, companyId: 1, sequenceYear: year, sequenceValue: number.sequenceValue, items: { create: items } }, select: { id: true, number: true } });
  });
  await prisma.auditLog.create({ data: { actorId: owner.id, action: "created", entityType: "Quotation", entityId: result.id, summary: `Created indicative ${plan.category} school payment plan quotation ${result.number}` } });
  redirect(`/dashboard/documents/${result.id}`);
}

export async function createInstallmentInvoices(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = documentIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/quotations?error=invalid");
  const actor = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } });
  const result = await prisma.$transaction(async (tx) => {
    const quote = await tx.document.findUnique({ where: { id: parsed.data.documentId }, include: { items: { orderBy: { sortOrder: "asc" } }, media: true } });
    if (!quote || quote.type !== "QUOTATION" || !quote.items.length) return { error: "invalid" as const };
    const existing = await tx.document.count({ where: { sourceDocumentId: quote.id, type: "INVOICE" } });
    if (existing) return { error: "exists" as const };
    const invoices = [];
    for (const item of quote.items) {
      const year = new Date().getFullYear();
      const number = await nextDocumentNumber(tx, "INVOICE", year);
      const invoice = await tx.document.create({ data: { number: number.number, type: "INVOICE", invoiceStatus: "DRAFT", subtotal: item.amount, tax: item.taxAmount, total: item.total, currency: quote.currency, customerId: quote.customerId, ownerId: actor?.id ?? quote.ownerId, companyId: quote.companyId, sourceDocumentId: quote.id, sequenceYear: year, sequenceValue: number.sequenceValue, items: { create: { description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate, amount: item.amount, taxAmount: item.taxAmount, total: item.total, sortOrder: item.sortOrder } }, ...(quote.media.length ? { media: { create: quote.media.map(({ filename, url, mimeType, size, title, description, altText, width, height, duration, caption, sortOrder }) => ({ filename, url, mimeType, size, title, description, altText, width, height, duration, caption, sortOrder })) } } : {}) }, select: { id: true, number: true } });
      invoices.push(invoice);
    }
    return { error: null as null, invoices, quoteNumber: quote.number };
  });
  if (result.error === "invalid") redirect("/dashboard/quotations?error=invalid");
  if (result.error === "exists") redirect(`/dashboard/documents/${parsed.data.documentId}?invoices=exists`);
  if (actor && result.error === null) await prisma.auditLog.create({ data: { actorId: actor.id, action: "created", entityType: "Invoice", entityId: parsed.data.documentId, summary: `Created ${result.invoices.length} installment invoices linked to quotation ${result.quoteNumber}` } });
  redirect(`/dashboard/documents/${parsed.data.documentId}?invoices=created`);
}

export async function issueInvoice(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = documentIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/invoices?error=invalid");
  const invoice = await prisma.document.findUnique({ where: { id: parsed.data.documentId }, select: { id: true, number: true, type: true, invoiceStatus: true } });
  if (!invoice || invoice.type !== "INVOICE" || invoice.invoiceStatus !== "DRAFT") redirect(`/dashboard/documents/${parsed.data.documentId}?error=invoice-state`);
  await prisma.document.update({ where: { id: invoice.id }, data: { invoiceStatus: "ISSUED" } });
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "issued", entityType: "Invoice", entityId: invoice.id, summary: `Issued invoice ${invoice.number}` } });
  redirect(`/dashboard/documents/${invoice.id}?issued=1`);
}

export async function recordInvoicePayment(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/invoices?error=invalid");
  const actor = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!actor) redirect("/dashboard/invoices?error=setup");
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.document.findUnique({ where: { id: parsed.data.invoiceId }, include: { payments: { select: { amount: true } }, media: true } });
    if (!invoice || invoice.type !== "INVOICE" || !["ISSUED", "PARTIALLY_PAID"].includes(invoice.invoiceStatus ?? "")) return { error: "state" as const };
    const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const amount = Math.round(parsed.data.amount * 100) / 100;
    if (amount > Math.round((invoice.total - paid) * 100) / 100) return { error: "excess" as const };
    const year = new Date().getFullYear();
    const number = await nextDocumentNumber(tx, "RECEIPT", year);
    const receipt = await tx.document.create({ data: { number: number.number, type: "RECEIPT", receiptStatus: "ISSUED", subtotal: amount, tax: 0, total: amount, currency: invoice.currency, customerId: invoice.customerId, ownerId: actor.id, companyId: invoice.companyId, sourceDocumentId: invoice.id, sequenceYear: year, sequenceValue: number.sequenceValue, items: { create: { description: `Payment received for invoice ${invoice.number}`, quantity: 1, unitPrice: amount, amount, taxRate: 0, taxAmount: 0, total: amount } }, ...(invoice.media.length ? { media: { create: invoice.media.map(({ filename, url, mimeType, size, title, description, altText, width, height, duration, caption, sortOrder }) => ({ filename, url, mimeType, size, title, description, altText, width, height, duration, caption, sortOrder })) } } : {}) }, select: { id: true, number: true } });
    await tx.payment.create({ data: { amount, method: parsed.data.method, reference: parsed.data.reference || null, customerId: invoice.customerId, documentId: invoice.id, receiptId: receipt.id } });
    const fullyPaid = paid + amount >= invoice.total - 0.005;
    await tx.document.update({ where: { id: invoice.id }, data: { invoiceStatus: fullyPaid ? "PAID" : "PARTIALLY_PAID" } });
    return { error: null as null, receipt, invoiceNumber: invoice.number };
  });
  if (result.error === "state") redirect(`/dashboard/documents/${parsed.data.invoiceId}?error=invoice-state`);
  if (result.error === "excess") redirect(`/dashboard/documents/${parsed.data.invoiceId}?error=payment-excess`);
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "recorded", entityType: "Payment", entityId: result.receipt.id, summary: `Recorded payment for invoice ${result.invoiceNumber}; receipt ${result.receipt.number}` } });
  redirect(`/dashboard/documents/${result.receipt.id}`);
}

export async function updateReceiptDetails(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = receiptEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/dashboard/documents/${String(formData.get("documentId") ?? "")}?receipt=invalid`);

  const amount = Math.round(parsed.data.amount * 100) / 100;
  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.document.findUnique({
      where: { id: parsed.data.documentId },
      include: { payment: true, items: { orderBy: { sortOrder: "asc" } }, sourceDocument: { include: { payments: { select: { id: true, amount: true } } } } },
    });
    if (!receipt || receipt.type !== "RECEIPT" || receipt.receiptStatus !== "ISSUED" || !receipt.payment || receipt.sourceDocument?.type !== "INVOICE" || receipt.items.length !== 1) return { error: "link" as const };

    const paidByOtherReceipts = receipt.sourceDocument.payments
      .filter((payment) => payment.id !== receipt.payment!.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const revisedPaidTotal = Math.round((paidByOtherReceipts + amount) * 100) / 100;
    if (revisedPaidTotal > Math.round(receipt.sourceDocument.total * 100) / 100 + 0.005) return { error: "balance" as const };

    await tx.payment.update({ where: { id: receipt.payment.id }, data: { amount, method: parsed.data.method, reference: parsed.data.reference || null } });
    await tx.documentItem.update({ where: { id: receipt.items[0].id }, data: { description: parsed.data.description, quantity: 1, unitPrice: amount, discount: 0, taxRate: 0, amount, taxAmount: 0, total: amount } });
    await tx.document.update({ where: { id: receipt.id }, data: { subtotal: amount, tax: 0, total: amount } });
    const invoiceStatus = revisedPaidTotal >= receipt.sourceDocument.total - 0.005 ? "PAID" : revisedPaidTotal > 0 ? "PARTIALLY_PAID" : "ISSUED";
    await tx.document.update({ where: { id: receipt.sourceDocument.id }, data: { invoiceStatus } });
    return { error: null as null, receiptNumber: receipt.number, invoiceNumber: receipt.sourceDocument.number };
  });

  if (result.error === "link") redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=unavailable`);
  if (result.error === "balance") redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=balance`);
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "updated", entityType: "Receipt", entityId: parsed.data.documentId, summary: `Updated receipt ${result.receiptNumber} and reconciled invoice ${result.invoiceNumber}` } });
  redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=updated`);
}

export async function updateQuotationOrInvoice(formData: FormData) {
  const session = await requirePrototypeSession();
  const documentId = String(formData.get("documentId") ?? "");
  const customerId = String(formData.get("customerId") ?? "");
  const terms = String(formData.get("terms") ?? "").trim();
  const itemIds = formData.getAll("itemId").map(String);
  const descriptions = formData.getAll("description");
  const quantities = formData.getAll("quantity");
  const unitPrices = formData.getAll("unitPrice");
  const discounts = formData.getAll("discount");
  const taxRates = formData.getAll("taxRate");
  const path = `/dashboard/documents/${encodeURIComponent(documentId)}`;
  const fields = [itemIds, descriptions, quantities, unitPrices, discounts, taxRates];
  if (!documentId || !customerId || terms.length > 8000 || !itemIds.length || itemIds.length > 100 || new Set(itemIds).size !== itemIds.length || fields.some((values) => values.length !== itemIds.length)) redirect(`${path}?edit=invalid`);
  const items = itemIds.map((itemId, index) => documentLineSchema.safeParse({ itemId, description: descriptions[index], quantity: quantities[index], unitPrice: unitPrices[index], discount: discounts[index], taxRate: taxRates[index] }));
  if (items.some((item) => !item.success)) redirect(`${path}?edit=invalid`);
  const parsedItems = items.map((item) => (item as { success: true; data: z.infer<typeof documentLineSchema> }).data);
  if (parsedItems.some((item) => item.discount > item.quantity * item.unitPrice)) redirect(`${path}?edit=invalid`);

  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.document.findUnique({ where: { id: documentId }, include: { items: { orderBy: { sortOrder: "asc" } }, payments: { select: { id: true } }, derivedDocuments: { select: { id: true }, where: { type: "INVOICE" } } } });
    if (!document || !["QUOTATION", "INVOICE"].includes(document.type)) return "invalid" as const;
    if (document.type === "QUOTATION" && document.derivedDocuments.length) return "locked" as const;
    if (document.type === "INVOICE" && (document.payments.length || document.invoiceStatus === "VOID")) return "locked" as const;
    if (document.items.length !== parsedItems.length || document.items.some((item) => !parsedItems.some((line) => line.itemId === item.id))) return "invalid" as const;
    if (!(await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } }))) return "invalid" as const;

    let subtotal = 0;
    let tax = 0;
    for (const [index, line] of parsedItems.entries()) {
      const amount = Math.round((line.quantity * line.unitPrice - line.discount) * 100) / 100;
      const taxAmount = Math.round(amount * line.taxRate) / 100;
      const total = Math.round((amount + taxAmount) * 100) / 100;
      subtotal = Math.round((subtotal + amount) * 100) / 100;
      tax = Math.round((tax + taxAmount) * 100) / 100;
      await tx.documentItem.update({ where: { id: line.itemId }, data: { description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount, taxRate: line.taxRate, amount, taxAmount, total, sortOrder: index } });
    }
    await tx.document.update({ where: { id: document.id }, data: { customerId, terms, subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 } });
    return "updated" as const;
  });
  if (result === "invalid") redirect(`${path}?edit=invalid`);
  if (result === "locked") redirect(`${path}?edit=locked`);
  revalidatePath(path);
  revalidatePath("/dashboard/quotations");
  revalidatePath("/dashboard/invoices");
  const updatedDocument = await prisma.document.findUnique({ where: { id: documentId }, select: { number: true, type: true } });
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "updated", entityType: "Document", entityId: documentId, summary: `Updated ${updatedDocument?.type.toLowerCase() ?? "document"} ${updatedDocument?.number ?? documentId}` } });
  redirect(`${path}?edit=updated`);
}

export async function createStaffAccount(formData: FormData) {
  const actor = await requirePrototypeAdminSession();
  const parsed = staffAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings?staff=invalid");

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) redirect("/dashboard/settings?staff=exists");

  const role = await prisma.role.upsert({
    where: { name: staffRoleName },
    create: { name: staffRoleName, description: "Prototype staff access to the workspace." },
    update: {},
    select: { id: true },
  });

  try {
    const staff = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: hashStaffPassword(parsed.data.password),
        roles: { create: { roleId: role.id } },
      },
      select: { id: true, name: true, email: true },
    });
    await prisma.auditLog.create({
      data: { actorId: actor.userId, action: "created", entityType: "User", entityId: staff.id, summary: `Created staff account for ${staff.email}` },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      redirect("/dashboard/settings?staff=exists");
    }
    throw error;
  }

  redirect("/dashboard/settings?staff=created");
}

export async function setStaffStatus(formData: FormData) {
  const actor = await requirePrototypeAdminSession();
  const parsed = staffStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.userId === actor.userId) redirect("/dashboard/settings?staff=invalid");

  const staff = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, roles: { select: { role: { select: { name: true } } } } },
  });
  if (!staff || staff.roles.some(({ role }) => role.name === adminRoleName)) redirect("/dashboard/settings?staff=invalid");

  await prisma.user.update({ where: { id: staff.id }, data: { status: parsed.data.status, sessionVersion: { increment: 1 } } });
  await prisma.auditLog.create({
    data: { actorId: actor.userId, action: parsed.data.status === "ACTIVE" ? "enabled" : "disabled", entityType: "User", entityId: staff.id, summary: `${parsed.data.status === "ACTIVE" ? "Enabled" : "Disabled"} staff account ${staff.email}` },
  });
  redirect("/dashboard/settings?staff=updated");
}

export async function resetStaffPassword(formData: FormData) {
  const actor = await requirePrototypeAdminSession();
  const parsed = staffPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.userId === actor.userId) redirect("/dashboard/settings?staff=invalid");

  const staff = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, roles: { select: { role: { select: { name: true } } } } },
  });
  if (!staff || staff.roles.some(({ role }) => role.name === adminRoleName)) redirect("/dashboard/settings?staff=invalid");

  await prisma.user.update({ where: { id: staff.id }, data: { passwordHash: hashStaffPassword(parsed.data.password), sessionVersion: { increment: 1 } } });
  await prisma.auditLog.create({
    data: { actorId: actor.userId, action: "password_reset", entityType: "User", entityId: staff.id, summary: `Reset password for staff account ${staff.email}` },
  });
  redirect("/dashboard/settings?staff=password-reset");
}

export async function updateProspectStatus(formData: FormData) {
  await requirePrototypeSession();
  const parsed = prospectStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/prospects?error=invalid");
  await prisma.prospect.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
  redirect("/dashboard/prospects?updated=1");
}

export async function createFinding(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = findingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/findings?error=invalid");
  const finding = await prisma.finding.create({ data: parsed.data });
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "created", entityType: "Finding", entityId: finding.id, summary: `Recorded finding: ${finding.title}` } });
  redirect("/dashboard/findings?created=1");
}

export async function updateFindingStatus(formData: FormData) {
  await requirePrototypeSession();
  const parsed = findingStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/findings?error=invalid");
  await prisma.finding.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
  redirect("/dashboard/findings?updated=1");
}

export async function createPortfolioProject(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = portfolioProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/portfolio?error=invalid");
  const project = await prisma.portfolioProject.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      location: parsed.data.location || null,
      summary: parsed.data.summary,
      completionYear: typeof parsed.data.completionYear === "number" ? parsed.data.completionYear : null,
      isPublished: parsed.data.isPublished === "on",
    },
  });
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "created", entityType: "PortfolioProject", entityId: project.id, summary: `Added portfolio project ${project.title}` } });
  redirect("/dashboard/portfolio?created=1");
}

export async function setPortfolioProjectPublished(formData: FormData) {
  await requirePrototypeSession();
  const parsed = portfolioProjectStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/portfolio?error=invalid");
  await prisma.portfolioProject.update({ where: { id: parsed.data.id }, data: { isPublished: parsed.data.isPublished === "true" } });
  redirect("/dashboard/portfolio?updated=1");
}

const whatsappSchema = z.object({
  number: z.string().trim().max(40),
  message: z.string().trim().max(500),
});

export async function updateWhatsappSettings(formData: FormData) {
  const actor = await requirePrototypeAdminSession();
  const parsed = whatsappSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings?whatsapp=invalid");

  // An empty number switches the floating button off.
  const number = parsed.data.number === "" ? null : normalizeWhatsappNumber(parsed.data.number);
  if (parsed.data.number !== "" && !number) redirect("/dashboard/settings?whatsapp=invalid");

  await prisma.companyProfile.update({ where: { companyId: 1 }, data: { whatsappNumber: number, whatsappMessage: parsed.data.message || null } });
  await prisma.auditLog.create({
    data: { actorId: actor.userId, action: "updated", entityType: "CompanyProfile", entityId: "1", summary: number ? `Set WhatsApp number to ${number}` : "Turned off the WhatsApp button" },
  });
  revalidatePath("/", "layout");
  redirect("/dashboard/settings?whatsapp=saved");
}
