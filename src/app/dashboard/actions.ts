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
import { isPortfolioMediaType } from "@/lib/portfolio-media";

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

const customerSelectionFields = {
  customerId: z.string().optional(),
  newCustomerName: z.string().trim().min(2).max(120).optional(),
  newCustomerCompany: z.string().trim().max(120).optional(),
  newCustomerEmail: z.union([z.literal(""), z.email()]).optional(),
  newCustomerPhone: z.string().trim().max(40).optional(),
};
const customerSelectionSchema = z.object(customerSelectionFields);
const quotationSchema = z.object({
  ...customerSelectionFields,
  description: z.string().trim().min(2).max(250),
  quantity: z.coerce.number().positive().max(100000),
  unitPrice: z.coerce.number().nonnegative().max(100000000),
}).refine((value) => value.customerId === "__new__" ? Boolean(value.newCustomerName && value.newCustomerName.length >= 2) : Boolean(value.customerId));
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
const receiptCreateSchema = z.object({ sourceDocumentId: z.string().optional(), ...customerSelectionFields, amount: z.coerce.number().positive().max(100000000), currency: z.enum(["KES", "USD"]).optional(), method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY"]), reference: z.string().trim().max(120).optional(), description: z.string().trim().min(2).max(250) }).superRefine((value, context) => {
  if (value.sourceDocumentId && value.customerId === "__new__") {
    context.addIssue({ code: "custom", path: ["customerId"], message: "Linked receipts must use the source document customer" });
  } else if (!value.sourceDocumentId && (value.customerId === "__new__" ? !value.newCustomerName : !value.customerId)) {
    context.addIssue({ code: "custom", path: ["customerId"], message: "Choose or create a customer" });
  }
});
const receiptEditSchema = z.object({ documentId: z.string().min(1), amount: z.coerce.number().positive().max(100000000), method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY"]), reference: z.string().trim().max(120).optional() });
const documentLineSchema = z.object({ itemId: z.string().optional(), description: z.string().trim().min(2).max(250), quantity: z.coerce.number().positive().max(100000), unitPrice: z.coerce.number().nonnegative().max(100000000), discount: z.coerce.number().nonnegative().max(100000000), taxRate: z.coerce.number().nonnegative().max(100) });

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
const portfolioProjectMediaSchema = z.object({ id: z.string().min(1) });

const maxPortfolioMediaFiles = 10;
const maxPortfolioMediaBytes = 3 * 1024 * 1024;

async function resolveCustomer(tx: Prisma.TransactionClient, selection: z.infer<typeof customerSelectionSchema>) {
  if (selection.customerId === "__new__") {
    if (!selection.newCustomerName) return null;
    const customer = await tx.customer.create({
      data: {
        name: selection.newCustomerName,
        company: selection.newCustomerCompany || null,
        email: selection.newCustomerEmail || null,
        phone: selection.newCustomerPhone || null,
      },
      select: { id: true, name: true },
    });
    return { customer, created: true };
  }
  if (!selection.customerId) return null;
  const customer = await tx.customer.findUnique({ where: { id: selection.customerId }, select: { id: true, name: true } });
  return customer ? { customer, created: false } : null;
}

async function preparePortfolioMedia(formData: FormData, uploadedById: string) {
  const values = formData.getAll("media");
  if (values.some((value) => typeof value !== "string" && !(value instanceof File))) return null;
  const files = values.filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > maxPortfolioMediaFiles || files.reduce((total, file) => total + file.size, 0) > maxPortfolioMediaBytes) return null;
  if (files.some((file) => !isPortfolioMediaType(file.type.toLowerCase()))) return null;

  return Promise.all(files.map(async (file) => {
    const filename = file.name.replace(/[\\/]/g, "_").slice(0, 255) || "project-media";
    const contents = Buffer.from(await file.arrayBuffer()).toString("base64");
    return {
      filename,
      url: `data:${file.type.toLowerCase()};base64,${contents}`,
      mimeType: file.type.toLowerCase(),
      size: file.size,
      title: filename,
      altText: filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      collection: "PORTFOLIO" as const,
      uploadedById,
    };
  }));
}

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
    const customer = await resolveCustomer(tx, parsed.data);
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

    const document = await tx.document.create({
      data: {
        number, type: "QUOTATION", quotationStatus: "DRAFT", subtotal, tax, total,
        customerId: customer.customer.id, ownerId: owner.id, companyId: 1, sequenceYear: year, sequenceValue,
        items: { create: { description: parsed.data.description, quantity: parsed.data.quantity, unitPrice: parsed.data.unitPrice, taxRate, amount: subtotal, taxAmount: tax, total } },
      },
      select: { id: true, number: true },
    });
    return { ...document, customer: customer.customer, customerCreated: customer.created };
  });

  if (!result) redirect("/dashboard/quotations?error=customer");
  if (result.customerCreated) {
    await prisma.auditLog.create({ data: { actorId: owner.id, action: "created", entityType: "Customer", entityId: result.customer.id, summary: `Created customer ${result.customer.name} from a quotation` } });
  }
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
    const quote = await tx.document.findUnique({ where: { id: parsed.data.documentId }, include: { items: { orderBy: { sortOrder: "asc" } }, media: true, payments: { select: { id: true } } } });
    if (!quote || quote.type !== "QUOTATION" || !quote.items.length) return { error: "invalid" as const };
    if (quote.payments.length) return { error: "payments" as const };
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
  if (result.error === "payments") redirect(`/dashboard/documents/${parsed.data.documentId}?invoices=payments`);
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

export async function createReceipt(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = receiptCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/receipts?error=invalid");
  const actor = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!actor) redirect("/dashboard/receipts?error=setup");

  const result = await prisma.$transaction(async (tx) => {
    const source = parsed.data.sourceDocumentId
      ? await tx.document.findUnique({
        where: { id: parsed.data.sourceDocumentId },
        include: { payments: { select: { amount: true } }, derivedDocuments: { where: { type: "INVOICE" }, select: { id: true } }, media: true },
      })
      : null;
    if (parsed.data.sourceDocumentId && !source) return { error: "source" as const };
    if (source && source.type !== "INVOICE" && source.type !== "QUOTATION") return { error: "source" as const };
    if (source?.type === "INVOICE" && !["ISSUED", "PARTIALLY_PAID"].includes(source.invoiceStatus ?? "")) return { error: "state" as const };
    if (source?.type === "QUOTATION" && source.derivedDocuments.length > 0) return { error: "invoiced" as const };

    const amount = Math.round(parsed.data.amount * 100) / 100;
    const paid = source?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
    if (source && amount > Math.round((source.total - paid) * 100) / 100 + 0.005) return { error: "balance" as const };
    const selectedCustomer = source ? null : await resolveCustomer(tx, parsed.data);
    const customerId = source?.customerId ?? selectedCustomer?.customer.id;
    if (!customerId) return { error: "customer" as const };

    const year = new Date().getFullYear();
    const number = await nextDocumentNumber(tx, "RECEIPT", year);
    const currency = source?.currency ?? parsed.data.currency ?? "KES";
    const receipt = await tx.document.create({
      data: {
        number: number.number,
        type: "RECEIPT",
        receiptStatus: "ISSUED",
        subtotal: amount,
        tax: 0,
        total: amount,
        currency,
        customerId,
        ownerId: actor.id,
        companyId: source?.companyId ?? 1,
        sourceDocumentId: source?.id ?? null,
        sequenceYear: year,
        sequenceValue: number.sequenceValue,
        items: { create: { description: parsed.data.description, quantity: 1, unitPrice: amount, amount, taxRate: 0, taxAmount: 0, total: amount } },
        ...(source?.media.length ? { media: { create: source.media.map(({ filename, url, mimeType, size, title, description, altText, width, height, duration, caption, sortOrder }) => ({ filename, url, mimeType, size, title, description, altText, width, height, duration, caption, sortOrder })) } } : {}),
      },
      select: { id: true, number: true },
    });
    await tx.payment.create({
      data: {
        amount,
        method: parsed.data.method,
        reference: parsed.data.reference || null,
        customerId,
        documentId: source?.id ?? null,
        receiptId: receipt.id,
      },
    });
    if (source?.type === "INVOICE") {
      const fullyPaid = paid + amount >= source.total - 0.005;
      await tx.document.update({ where: { id: source.id }, data: { invoiceStatus: fullyPaid ? "PAID" : "PARTIALLY_PAID" } });
    }
    return { error: null as null, receipt, source, createdCustomer: selectedCustomer?.created ? selectedCustomer.customer : null };
  });

  if (result.error === "source") redirect("/dashboard/receipts?error=source");
  if (result.error === "state") redirect(`/dashboard/receipts?sourceDocumentId=${encodeURIComponent(parsed.data.sourceDocumentId ?? "")}&error=invoice-state`);
  if (result.error === "invoiced") redirect(`/dashboard/receipts?sourceDocumentId=${encodeURIComponent(parsed.data.sourceDocumentId ?? "")}&error=quotation-invoiced`);
  if (result.error === "balance") redirect(`/dashboard/receipts?sourceDocumentId=${encodeURIComponent(parsed.data.sourceDocumentId ?? "")}&error=balance`);
  if (result.error === "customer") redirect("/dashboard/receipts?error=customer");
  if (result.createdCustomer) await prisma.auditLog.create({ data: { actorId: actor.id, action: "created", entityType: "Customer", entityId: result.createdCustomer.id, summary: `Created customer ${result.createdCustomer.name} from a receipt` } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "created", entityType: "Receipt", entityId: result.receipt.id, summary: `Created receipt ${result.receipt.number}${result.source ? ` for ${result.source.type.toLowerCase()} ${result.source.number}` : " without a linked invoice or quotation"}` } });
  revalidatePath("/dashboard/receipts");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/quotations");
  redirect(`/dashboard/documents/${result.receipt.id}?receipt=created`);
}

export async function updateReceiptDetails(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = receiptEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/dashboard/documents/${String(formData.get("documentId") ?? "")}?receipt=invalid`);

  const receiptItemIds = formData.getAll("receiptItemId").map(String);
  const descriptions = formData.getAll("receiptDescription");
  const quantities = formData.getAll("receiptQuantity");
  const unitPrices = formData.getAll("receiptUnitPrice");
  const discounts = formData.getAll("receiptDiscount");
  const taxRates = formData.getAll("receiptTaxRate");
  const receiptFields = [receiptItemIds, descriptions, quantities, unitPrices, discounts, taxRates];
  if (!receiptItemIds.length || receiptItemIds.length > 100 || receiptFields.some((values) => values.length !== receiptItemIds.length)) {
    redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=invalid`);
  }
  const rows = receiptItemIds.map((itemId, index) => documentLineSchema.safeParse({
    itemId: itemId || undefined,
    description: String(descriptions[index] ?? "").trim(),
    quantity: quantities[index],
    unitPrice: unitPrices[index],
    discount: discounts[index],
    taxRate: taxRates[index],
  }));
  if (rows.some((row) => !row.success) || rows.some((row) => row.success && row.data.discount > row.data.quantity * row.data.unitPrice)) {
    redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=invalid`);
  }
  const validRows = rows.filter((row): row is { success: true; data: z.infer<typeof documentLineSchema> } => row.success);
  let subtotal = 0;
  let tax = 0;
  const calculatedRows = validRows.map((row, index) => {
    const amount = Math.round((row.data.quantity * row.data.unitPrice - row.data.discount) * 100) / 100;
    const taxAmount = Math.round(amount * row.data.taxRate) / 100;
    subtotal = Math.round((subtotal + amount) * 100) / 100;
    tax = Math.round((tax + taxAmount) * 100) / 100;
    return { ...row.data, amount, taxAmount, total: Math.round((amount + taxAmount) * 100) / 100, sortOrder: index };
  });
  const amount = Math.round((subtotal + tax) * 100) / 100;
  if (amount <= 0 || amount !== Math.round(parsed.data.amount * 100) / 100) redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=invalid`);

  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.document.findUnique({
      where: { id: parsed.data.documentId },
      include: { payment: true, items: { orderBy: { sortOrder: "asc" } }, sourceDocument: { include: { payments: { select: { id: true, amount: true } } } } },
    });
    if (!receipt || receipt.type !== "RECEIPT" || receipt.receiptStatus !== "ISSUED" || !receipt.payment || (receipt.sourceDocument && !["INVOICE", "QUOTATION"].includes(receipt.sourceDocument.type))) return { error: "link" as const };

    const existingItemIds = new Set(receipt.items.map((item) => item.id));
    const submittedItemIds = calculatedRows.filter((row) => row.itemId).map((row) => row.itemId as string);
    if (new Set(submittedItemIds).size !== submittedItemIds.length || submittedItemIds.some((itemId) => !existingItemIds.has(itemId)) || receipt.items.some((item) => !submittedItemIds.includes(item.id))) return { error: "link" as const };

    const paidByOtherReceipts = receipt.sourceDocument?.payments
      .filter((payment) => payment.id !== receipt.payment!.id)
      .reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
    const revisedPaidTotal = Math.round((paidByOtherReceipts + amount) * 100) / 100;
    if (receipt.sourceDocument && revisedPaidTotal > Math.round(receipt.sourceDocument.total * 100) / 100 + 0.005) return { error: "balance" as const };

    await tx.payment.update({ where: { id: receipt.payment.id }, data: { amount, method: parsed.data.method, reference: parsed.data.reference || null } });
    for (const row of calculatedRows) {
      if (row.itemId) {
        await tx.documentItem.update({ where: { id: row.itemId }, data: { description: row.description, quantity: row.quantity, unitPrice: row.unitPrice, discount: row.discount, taxRate: row.taxRate, amount: row.amount, taxAmount: row.taxAmount, total: row.total, sortOrder: row.sortOrder } });
      } else {
        await tx.documentItem.create({ data: { documentId: receipt.id, description: row.description, quantity: row.quantity, unitPrice: row.unitPrice, discount: row.discount, taxRate: row.taxRate, amount: row.amount, taxAmount: row.taxAmount, total: row.total, sortOrder: row.sortOrder } });
      }
    }
    await tx.document.update({ where: { id: receipt.id }, data: { subtotal, tax, total: amount } });
    if (receipt.sourceDocument?.type === "INVOICE") {
      const invoiceStatus = revisedPaidTotal >= receipt.sourceDocument.total - 0.005 ? "PAID" : revisedPaidTotal > 0 ? "PARTIALLY_PAID" : "ISSUED";
      await tx.document.update({ where: { id: receipt.sourceDocument.id }, data: { invoiceStatus } });
    }
    return { error: null as null, receiptNumber: receipt.number, sourceNumber: receipt.sourceDocument?.number ?? null };
  });

  if (result.error === "link") redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=unavailable`);
  if (result.error === "balance") redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=balance`);
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "updated", entityType: "Receipt", entityId: parsed.data.documentId, summary: `Updated receipt ${result.receiptNumber}${result.sourceNumber ? ` linked to ${result.sourceNumber}` : ""}` } });
  redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=updated`);
}

export async function updateQuotationOrInvoice(formData: FormData) {
  const session = await requirePrototypeSession();
  const documentId = String(formData.get("documentId") ?? "");
  const customerSelection = customerSelectionSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    newCustomerName: formData.get("newCustomerName") ?? undefined,
    newCustomerCompany: formData.get("newCustomerCompany") ?? undefined,
    newCustomerEmail: formData.get("newCustomerEmail") ?? undefined,
    newCustomerPhone: formData.get("newCustomerPhone") ?? undefined,
  });
  const terms = String(formData.get("terms") ?? "").trim();
  const itemIds = formData.getAll("itemId").map(String);
  const descriptions = formData.getAll("description");
  const quantities = formData.getAll("quantity");
  const unitPrices = formData.getAll("unitPrice");
  const discounts = formData.getAll("discount");
  const taxRates = formData.getAll("taxRate");
  const path = `/dashboard/documents/${encodeURIComponent(documentId)}`;
  const fields = [itemIds, descriptions, quantities, unitPrices, discounts, taxRates];
  if (!documentId || !customerSelection.success || !customerSelection.data.customerId || terms.length > 8000 || !itemIds.length || itemIds.length > 100 || fields.some((values) => values.length !== itemIds.length)) redirect(`${path}?edit=invalid`);

  const rows = itemIds.map((itemId, index) => {
    const description = String(descriptions[index] ?? "").trim();
    const quantity = String(quantities[index] ?? "").trim();
    const unitPrice = String(unitPrices[index] ?? "").trim();
    const discount = String(discounts[index] ?? "").trim();
    const taxRate = String(taxRates[index] ?? "").trim();
    const hasValue = description || quantity || unitPrice || discount || taxRate;
    if (!hasValue) return null;
    return documentLineSchema.safeParse({ itemId: itemId || undefined, description, quantity, unitPrice, discount, taxRate });
  }).filter((row): row is { success: true; data: z.infer<typeof documentLineSchema> } => row !== null && row.success);

  if (rows.length === 0 || rows.some((row) => row.data.discount > row.data.quantity * row.data.unitPrice)) redirect(`${path}?edit=invalid`);
  const existingItemIds = rows.filter((row) => row.data.itemId).map((row) => row.data.itemId as string);
  if (new Set(existingItemIds).size !== existingItemIds.length) redirect(`${path}?edit=invalid`);

  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.document.findUnique({ where: { id: documentId }, include: { items: { orderBy: { sortOrder: "asc" } }, payments: { select: { id: true } }, derivedDocuments: { select: { id: true }, where: { type: "INVOICE" } } } });
    if (!document || !["QUOTATION", "INVOICE"].includes(document.type)) return { status: "invalid" as const };
    if (document.type === "QUOTATION" && document.derivedDocuments.length) return { status: "locked" as const };
    if (document.type === "INVOICE" && (document.payments.length || document.invoiceStatus === "VOID")) return { status: "locked" as const };

    const existingDocumentItemIds = new Set(document.items.map((item) => item.id));
    for (const row of rows) {
      if (row.data.itemId && !existingDocumentItemIds.has(row.data.itemId)) return { status: "invalid" as const };
    }
    if (document.items.some((item) => !rows.some((row) => row.data.itemId === item.id)) && rows.some((row) => row.data.itemId)) {
      const missingItem = document.items.find((item) => !rows.some((row) => row.data.itemId === item.id));
      if (missingItem) return { status: "invalid" as const };
    }

    const selectedCustomer = await resolveCustomer(tx, customerSelection.data);
    if (!selectedCustomer) return { status: "invalid" as const };

    let subtotal = 0;
    let tax = 0;
    for (const [index, row] of rows.entries()) {
      const amount = Math.round((row.data.quantity * row.data.unitPrice - row.data.discount) * 100) / 100;
      const taxAmount = Math.round(amount * row.data.taxRate) / 100;
      const total = Math.round((amount + taxAmount) * 100) / 100;
      subtotal = Math.round((subtotal + amount) * 100) / 100;
      tax = Math.round((tax + taxAmount) * 100) / 100;
      if (row.data.itemId) {
        await tx.documentItem.update({ where: { id: row.data.itemId }, data: { description: row.data.description, quantity: row.data.quantity, unitPrice: row.data.unitPrice, discount: row.data.discount, taxRate: row.data.taxRate, amount, taxAmount, total, sortOrder: index } });
      } else {
        await tx.documentItem.create({
          data: {
            documentId: document.id,
            description: row.data.description,
            quantity: row.data.quantity,
            unitPrice: row.data.unitPrice,
            discount: row.data.discount,
            taxRate: row.data.taxRate,
            amount,
            taxAmount,
            total,
            sortOrder: index,
          },
        });
      }
    }

    const remainingItems = await tx.documentItem.findMany({ where: { documentId: document.id }, select: { id: true } });
    const incomingIds = new Set(rows.filter((row) => row.data.itemId).map((row) => row.data.itemId as string));
    const staleItems = remainingItems.filter((item) => !incomingIds.has(item.id));
    if (staleItems.length > 0) {
      await Promise.all(staleItems.map((item) => tx.documentItem.delete({ where: { id: item.id } })));
    }

    await tx.document.update({ where: { id: document.id }, data: { customerId: selectedCustomer.customer.id, terms, subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 } });
    return { status: "updated" as const, createdCustomer: selectedCustomer.created ? selectedCustomer.customer : null };
  });
  if (result.status === "invalid") redirect(`${path}?edit=invalid`);
  if (result.status === "locked") redirect(`${path}?edit=locked`);
  revalidatePath(path);
  revalidatePath("/dashboard/quotations");
  revalidatePath("/dashboard/invoices");
  const updatedDocument = await prisma.document.findUnique({ where: { id: documentId }, select: { number: true, type: true } });
  if (result.createdCustomer) await prisma.auditLog.create({ data: { actorId: session.userId, action: "created", entityType: "Customer", entityId: result.createdCustomer.id, summary: `Created customer ${result.createdCustomer.name} from a document edit` } });
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
  const media = await preparePortfolioMedia(formData, session.userId);
  if (!media) redirect("/dashboard/portfolio?error=media");
  const project = await prisma.portfolioProject.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      location: parsed.data.location || null,
      summary: parsed.data.summary,
      completionYear: typeof parsed.data.completionYear === "number" ? parsed.data.completionYear : null,
      isPublished: parsed.data.isPublished === "on",
      ...(media.length ? { media: { create: media } } : {}),
    },
  });
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "created", entityType: "PortfolioProject", entityId: project.id, summary: `Added portfolio project ${project.title}` } });
  revalidatePath("/portfolio");
  redirect("/dashboard/portfolio?created=1");
}

export async function addPortfolioProjectMedia(formData: FormData) {
  const session = await requirePrototypeSession();
  const parsed = portfolioProjectMediaSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/dashboard/portfolio?error=invalid");
  const media = await preparePortfolioMedia(formData, session.userId);
  if (!media?.length) redirect("/dashboard/portfolio?error=media");

  const project = await prisma.portfolioProject.update({
    where: { id: parsed.data.id },
    data: { media: { create: media } },
    select: { id: true, title: true },
  });
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "updated", entityType: "PortfolioProject", entityId: project.id, summary: `Added media to portfolio project ${project.title}` } });
  revalidatePath("/portfolio");
  revalidatePath("/dashboard/portfolio");
  redirect("/dashboard/portfolio?media=added");
}

export async function setPortfolioProjectPublished(formData: FormData) {
  await requirePrototypeSession();
  const parsed = portfolioProjectStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/portfolio?error=invalid");
  await prisma.portfolioProject.update({ where: { id: parsed.data.id }, data: { isPublished: parsed.data.isPublished === "true" } });
  revalidatePath("/portfolio");
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
