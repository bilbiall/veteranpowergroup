"use server";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import sharp from "sharp";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashStaffPassword, requirePrototypeAdminSession, requirePrototypeSession, requireSectionAccess, requireStaffManagementSession } from "@/lib/prototype-auth";
import { getSchoolPaymentPlan } from "@/lib/school-payment-plans";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import { isPortfolioMediaType } from "@/lib/portfolio-media";
import { documentSection, isStaffAccessKey, isStaffSectionKey } from "@/lib/staff-sections";

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

function parseStaffSections(formData: FormData) {
  const sections = [...new Set(formData.getAll("sections"))];
  if (!sections.every(isStaffAccessKey)) return null;
  if (sections.includes("company-profile") && !sections.includes("settings")) sections.push("settings");
  return sections.some(isStaffSectionKey) ? sections : null;
}

const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.union([z.literal(""), z.email()]).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
});
const customerIdSchema = z.object({ customerId: z.string().min(1) });

const customerSelectionFields = {
  customerId: z.string().optional(),
  newCustomerName: z.string().trim().max(120).optional(),
  newCustomerCompany: z.string().trim().max(120).optional(),
  newCustomerEmail: z.union([z.literal(""), z.email()]).optional(),
  newCustomerPhone: z.string().trim().max(40).optional(),
};
const customerSelectionSchema = z.object(customerSelectionFields);
const quotationSchema = z.object({
  ...customerSelectionFields,
  terms: z.string().trim().max(8000).optional(),
}).refine((value) => value.customerId === "__new__" ? Boolean(value.newCustomerName && value.newCustomerName.length >= 2) : Boolean(value.customerId));
const standaloneInvoiceSchema = z.object({
  ...customerSelectionFields,
  terms: z.string().trim().max(8000).optional(),
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
const receiptCreateSchema = z.object({ sourceDocumentId: z.string().optional(), ...customerSelectionFields, currency: z.enum(["KES", "USD"]).optional(), method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY"]), reference: z.string().trim().max(120).optional() }).superRefine((value, context) => {
  if (value.sourceDocumentId && value.customerId === "__new__") {
    context.addIssue({ code: "custom", path: ["customerId"], message: "Linked receipts must use the source document customer" });
  } else if (!value.sourceDocumentId && (value.customerId === "__new__" ? !value.newCustomerName : !value.customerId)) {
    context.addIssue({ code: "custom", path: ["customerId"], message: "Choose or create a customer" });
  }
});
const receiptEditSchema = z.object({ documentId: z.string().min(1), amount: z.coerce.number().positive().max(100000000), method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY"]), reference: z.string().trim().max(120).optional() });
const documentLineSchema = z.object({ itemId: z.string().optional(), description: z.string().trim().min(2).max(250), quantity: z.coerce.number().positive().max(100000), unitPrice: z.coerce.number().nonnegative().max(100000000), discount: z.coerce.number().nonnegative().max(100000000), taxRate: z.coerce.number().nonnegative().max(100) });

function parseLineItems(formData: FormData, prefix = "") {
  const fieldName = (name: string) => prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
  const itemIds = formData.getAll(fieldName("itemId")).map(String);
  const descriptions = formData.getAll(fieldName("description"));
  const quantities = formData.getAll(fieldName("quantity"));
  const unitPrices = formData.getAll(fieldName("unitPrice"));
  const discounts = formData.getAll(fieldName("discount"));
  const taxRates = formData.getAll(fieldName("taxRate"));
  const fields = [itemIds, descriptions, quantities, unitPrices, discounts, taxRates];
  if (!itemIds.length || itemIds.length > 100 || fields.some((values) => values.length !== itemIds.length)) return null;
  const rows = itemIds.map((itemId, index) => documentLineSchema.safeParse({
    itemId: itemId || undefined,
    description: String(descriptions[index] ?? "").trim(),
    quantity: quantities[index],
    unitPrice: unitPrices[index],
    discount: discounts[index],
    taxRate: taxRates[index],
  }));
  if (rows.some((row) => !row.success || row.data.discount > row.data.quantity * row.data.unitPrice)) return null;
  return rows.map((row, sortOrder) => {
    if (!row.success) return null;
    const amount = Math.round((row.data.quantity * row.data.unitPrice - row.data.discount) * 100) / 100;
    const taxAmount = Math.round(amount * row.data.taxRate) / 100;
    return { ...row.data, amount, taxAmount, total: Math.round((amount + taxAmount) * 100) / 100, sortOrder };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
}

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
  category: z.array(z.enum(["Power Solutions", "Solar Solutions", "Borehole Solutions"])).min(1).max(3),
  location: z.string().trim().max(160).optional(),
  summary: z.string().trim().min(10).max(2000),
  completionYear: z.union([z.literal(""), z.coerce.number().int().min(1980).max(2100)]).optional(),
  isPublished: z.string().optional(),
});
const portfolioProjectStatusSchema = z.object({ id: z.string().min(1), isPublished: z.enum(["true", "false"]) });
const portfolioProjectDeleteSchema = z.object({ id: z.string().min(1) });
const portfolioProjectMediaSchema = z.object({ id: z.string().min(1) });

const maxPortfolioMediaFiles = 10;

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
  if (files.length > maxPortfolioMediaFiles) return null;
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
  const session = await requireSectionAccess("customers");
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

export async function deleteCustomer(formData: FormData) {
  const session = await requireSectionAccess("customers");
  const parsed = customerIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/customers?delete=missing");

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: parsed.data.customerId }, include: { _count: { select: { documents: true, payments: true } } } });
    if (!customer) return "missing" as const;
    if (customer._count.documents || customer._count.payments) return "linked" as const;
    await tx.customer.delete({ where: { id: customer.id } });
    await tx.auditLog.create({ data: { actorId: session.userId, action: "deleted", entityType: "Customer", entityId: customer.id, summary: `Deleted customer ${customer.name}` } });
    return "deleted" as const;
  });

  if (result !== "deleted") redirect(`/dashboard/customers?delete=${result}`);
  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers?deleted=1");
}

function normalizeCustomerIdentity(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export async function mergeDuplicateCustomers(formData: FormData) {
  const session = await requireSectionAccess("customers");
  const parsed = customerIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/customers?merge=missing");

  const result = await prisma.$transaction(async (tx) => {
    const customers = await tx.customer.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const selected = customers.find((customer) => customer.id === parsed.data.customerId);
    if (!selected) return { error: "missing" as const };
    const nameKey = normalizeCustomerIdentity(selected.name);
    const companyKey = normalizeCustomerIdentity(selected.company);
    const matches = customers.filter((customer) => normalizeCustomerIdentity(customer.name) === nameKey && normalizeCustomerIdentity(customer.company) === companyKey);
    if (matches.length < 2) return { error: "not-duplicate" as const };

    const keeper = matches[0];
    const duplicates = matches.slice(1);
    const duplicateIds = duplicates.map((customer) => customer.id);
    const updates: { email?: string | null; phone?: string | null; address?: string | null } = {};
    for (const field of ["email", "phone", "address"] as const) {
      if (!keeper[field]) updates[field] = duplicates.map((customer) => customer[field]).find((value) => Boolean(value?.trim())) ?? null;
    }
    if (Object.keys(updates).length) await tx.customer.update({ where: { id: keeper.id }, data: updates });
    await tx.document.updateMany({ where: { customerId: { in: duplicateIds } }, data: { customerId: keeper.id } });
    await tx.payment.updateMany({ where: { customerId: { in: duplicateIds } }, data: { customerId: keeper.id } });
    await tx.media.updateMany({ where: { customerId: { in: duplicateIds } }, data: { customerId: keeper.id } });
    await tx.customer.deleteMany({ where: { id: { in: duplicateIds } } });
    await tx.auditLog.create({ data: {
      actorId: session.userId,
      action: "merged",
      entityType: "Customer",
      entityId: keeper.id,
      summary: `Merged ${duplicates.length} duplicate customer record${duplicates.length === 1 ? "" : "s"} into ${keeper.name}`,
      metadata: {
        mergedCustomers: duplicates.map(({ id, name, company, email, phone, address }) => ({ id, name, company, email, phone, address })),
        company: keeper.company,
      },
    } });
    return { error: null, merged: duplicates.length };
  });

  if (result.error) redirect(`/dashboard/customers?merge=${result.error}`);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/quotations");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/receipts");
  redirect(`/dashboard/customers?merged=${result.merged}`);
}

export async function createQuotation(formData: FormData) {
  const session = await requireSectionAccess("quotations");
  const parsed = quotationSchema.safeParse(Object.fromEntries(formData));
  const lineItems = parseLineItems(formData);
  if (!parsed.success || !lineItems?.length) redirect("/dashboard/quotations?error=invalid");
  const owner = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } });
  const company = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { id: true } });
  if (!owner || !company) redirect("/dashboard/quotations?error=setup");

  const result = await prisma.$transaction(async (tx) => {
    const customer = await resolveCustomer(tx, parsed.data);
    if (!customer) return null;

    const year = new Date().getFullYear();
    const settings = await tx.documentSettings.findUnique({ where: { companyId: 1 }, select: { quotePrefix: true } });
    const prefix = settings?.quotePrefix ?? "QUO";
    const sequence = await tx.documentNumberSequence.upsert({
      where: { companyId_type_year: { companyId: 1, type: "QUOTATION", year } },
      create: { companyId: 1, type: "QUOTATION", year, prefix, nextValue: 2 },
      update: { nextValue: { increment: 1 }, prefix },
      select: { nextValue: true },
    });
    const sequenceValue = sequence.nextValue - 1;
    const rows = lineItems;
    const subtotal = rows.reduce((sum, item) => Math.round((sum + item.amount) * 100) / 100, 0);
    const tax = rows.reduce((sum, item) => Math.round((sum + item.taxAmount) * 100) / 100, 0);
    const total = Math.round((subtotal + tax) * 100) / 100;
    const number = `${prefix}-${year}-${String(sequenceValue).padStart(4, "0")}`;

    const document = await tx.document.create({
      data: {
        number, type: "QUOTATION", quotationStatus: "SENT", subtotal, tax, total,
        currency: "KES", terms: parsed.data.terms || null,
        customerId: customer.customer.id, ownerId: owner.id, companyId: 1, sequenceYear: year, sequenceValue,
        items: { create: rows.map((row) => { const item = { ...row }; delete item.itemId; return item; }) },
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
    data: { actorId: owner.id, action: "created", entityType: "Quotation", entityId: result.id, summary: `Created quotation ${result.number}` },
  });
  redirect(`/dashboard/documents/${result.id}`);
}

export async function createStandaloneInvoice(formData: FormData) {
  const session = await requireSectionAccess("invoices");
  const parsed = standaloneInvoiceSchema.safeParse(Object.fromEntries(formData));
  const lineItems = parseLineItems(formData);
  if (!parsed.success || !lineItems?.length) redirect("/dashboard/invoices?error=invalid");
  const actor = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } });
  const company = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { id: true } });
  if (!actor || !company) redirect("/dashboard/invoices?error=setup");

  const customerAndInvoice = await prisma.$transaction(async (tx) => {
    const selectedCustomer = await resolveCustomer(tx, parsed.data);
    if (!selectedCustomer) return null;
    const subtotal = Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const tax = Math.round(lineItems.reduce((sum, item) => sum + item.taxAmount, 0) * 100) / 100;
    const year = new Date().getFullYear();
    const number = await nextDocumentNumber(tx, "INVOICE", year);
    const invoice = await tx.document.create({
      data: {
        number: number.number,
        type: "INVOICE",
        invoiceStatus: "DRAFT",
        subtotal,
        tax,
        total: Math.round((subtotal + tax) * 100) / 100,
        currency: "KES",
        terms: parsed.data.terms || null,
        customerId: selectedCustomer.customer.id,
        ownerId: actor.id,
        companyId: company.id,
        sequenceYear: year,
        sequenceValue: number.sequenceValue,
        items: { create: lineItems.map((row) => { const item = { ...row }; delete item.itemId; return item; }) },
      },
      select: { id: true, number: true },
    });
    return { invoice, customer: selectedCustomer.customer, customerCreated: selectedCustomer.created };
  });
  if (!customerAndInvoice) redirect("/dashboard/invoices?error=customer");
  if (customerAndInvoice.customerCreated) await prisma.auditLog.create({ data: { actorId: actor.id, action: "created", entityType: "Customer", entityId: customerAndInvoice.customer.id, summary: `Created customer ${customerAndInvoice.customer.name} from an invoice` } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "created", entityType: "Invoice", entityId: customerAndInvoice.invoice.id, summary: `Created standalone draft invoice ${customerAndInvoice.invoice.number}` } });
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/customers");
  redirect(`/dashboard/documents/${customerAndInvoice.invoice.id}?invoice=created`);
}

export async function createSchoolPlanQuotation(formData: FormData) {
  const session = await requireSectionAccess("payment-plans");
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
    return tx.document.create({ data: { number: number.number, type: "QUOTATION", quotationStatus: "SENT", subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100, currency: parsed.data.currency, customerId: customer.id, ownerId: owner.id, companyId: 1, sequenceYear: year, sequenceValue: number.sequenceValue, items: { create: items } }, select: { id: true, number: true } });
  });
  await prisma.auditLog.create({ data: { actorId: owner.id, action: "created", entityType: "Quotation", entityId: result.id, summary: `Created indicative ${plan.category} school payment plan quotation ${result.number}` } });
  redirect(`/dashboard/documents/${result.id}`);
}

export async function createInvoiceFromQuotation(formData: FormData) {
  const session = await requireSectionAccess("invoices");
  const parsed = documentIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/quotations?error=invalid");
  const actor = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } });
  const result = await prisma.$transaction(async (tx) => {
    const quote = await tx.document.findUnique({ where: { id: parsed.data.documentId }, include: { items: { orderBy: { sortOrder: "asc" } }, media: true, payments: { select: { id: true } } } });
    if (!quote || quote.type !== "QUOTATION" || !quote.items.length) return { error: "invalid" as const };
    if (quote.payments.length) return { error: "payments" as const };
    const existing = await tx.document.count({ where: { sourceDocumentId: quote.id, type: "INVOICE" } });
    if (existing) return { error: "exists" as const };
    const year = new Date().getFullYear();
    const number = await nextDocumentNumber(tx, "INVOICE", year);
    const invoice = await tx.document.create({ data: {
      number: number.number,
      type: "INVOICE",
      invoiceStatus: "DRAFT",
      subtotal: quote.subtotal,
      tax: quote.tax,
      total: quote.total,
      terms: quote.terms,
      currency: quote.currency,
      customerId: quote.customerId,
      ownerId: actor?.id ?? quote.ownerId,
      companyId: quote.companyId,
      sourceDocumentId: quote.id,
      sequenceYear: year,
      sequenceValue: number.sequenceValue,
      items: { create: quote.items.map(({ description, quantity, unitPrice, discount, taxRate, amount, taxAmount, total, sortOrder }) => ({ description, quantity, unitPrice, discount, taxRate, amount, taxAmount, total, sortOrder })) },
      ...(quote.media.length ? { media: { create: quote.media.map(({ filename, url, mimeType, size, title, description, altText, width, height, duration, caption, sortOrder }) => ({ filename, url, mimeType, size, title, description, altText, width, height, duration, caption, sortOrder })) } } : {}),
    }, select: { id: true, number: true } });
    return { error: null as null, invoice, quoteNumber: quote.number };
  });
  if (result.error === "invalid") redirect("/dashboard/quotations?error=invalid");
  if (result.error === "exists") redirect(`/dashboard/documents/${parsed.data.documentId}?invoice=exists`);
  if (result.error === "payments") redirect(`/dashboard/documents/${parsed.data.documentId}?invoice=payments`);
  if (actor && result.error === null) await prisma.auditLog.create({ data: { actorId: actor.id, action: "created", entityType: "Invoice", entityId: result.invoice.id, summary: `Created invoice ${result.invoice.number} linked to quotation ${result.quoteNumber}` } });
  revalidatePath("/dashboard/quotations");
  revalidatePath("/dashboard/invoices");
  redirect(`/dashboard/documents/${result.invoice.id}?invoice=created`);
}

export async function issueInvoice(formData: FormData) {
  const session = await requireSectionAccess("invoices");
  const parsed = documentIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/invoices?error=invalid");
  const invoice = await prisma.document.findUnique({ where: { id: parsed.data.documentId }, select: { id: true, number: true, type: true, invoiceStatus: true } });
  if (!invoice || invoice.type !== "INVOICE" || invoice.invoiceStatus !== "DRAFT") redirect(`/dashboard/documents/${parsed.data.documentId}?error=invoice-state`);
  await prisma.document.update({ where: { id: invoice.id }, data: { invoiceStatus: "ISSUED" } });
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "issued", entityType: "Invoice", entityId: invoice.id, summary: `Issued invoice ${invoice.number}` } });
  redirect(`/dashboard/documents/${invoice.id}?issued=1`);
}

export async function recordInvoicePayment(formData: FormData) {
  const session = await requireSectionAccess("invoices");
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
  const session = await requireSectionAccess("receipts");
  const parsed = receiptCreateSchema.safeParse(Object.fromEntries(formData));
  const lineItems = parseLineItems(formData, "receipt");
  if (!parsed.success || !lineItems?.length) redirect("/dashboard/receipts?error=invalid");
  const subtotal = Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const tax = Math.round(lineItems.reduce((sum, item) => sum + item.taxAmount, 0) * 100) / 100;
  const amount = Math.round(lineItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  if (amount <= 0) redirect("/dashboard/receipts?error=invalid");
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
    if (source && source.type !== "INVOICE") return { error: "source" as const };
    if (source?.type === "INVOICE" && !["ISSUED", "PARTIALLY_PAID"].includes(source.invoiceStatus ?? "")) return { error: "state" as const };
    if (source?.type === "QUOTATION") return { error: "source" as const };

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
        subtotal,
        tax,
        total: amount,
        currency,
        customerId,
        ownerId: actor.id,
        companyId: source?.companyId ?? 1,
        sourceDocumentId: source?.id ?? null,
        sequenceYear: year,
        sequenceValue: number.sequenceValue,
        items: { create: lineItems.map((row) => { const item = { ...row }; delete item.itemId; return item; }) },
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
  const session = await requireSectionAccess("receipts");
  const parsed = receiptEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/dashboard/documents/${String(formData.get("documentId") ?? "")}?receipt=invalid`);

  const calculatedRows = parseLineItems(formData, "receipt");
  if (!calculatedRows?.length) {
    redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=invalid`);
  }
  const subtotal = Math.round(calculatedRows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
  const tax = Math.round(calculatedRows.reduce((sum, row) => sum + row.taxAmount, 0) * 100) / 100;
  const amount = Math.round((subtotal + tax) * 100) / 100;
  if (amount <= 0) redirect(`/dashboard/documents/${parsed.data.documentId}?receipt=invalid`);

  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.document.findUnique({
      where: { id: parsed.data.documentId },
      include: { payment: true, items: { orderBy: { sortOrder: "asc" } }, sourceDocument: { include: { payments: { select: { id: true, amount: true } } } } },
    });
    if (!receipt || receipt.type !== "RECEIPT" || receipt.receiptStatus !== "ISSUED" || !receipt.payment || (receipt.sourceDocument && !["INVOICE", "QUOTATION"].includes(receipt.sourceDocument.type))) return { error: "link" as const };

    const existingItemIds = new Set(receipt.items.map((item) => item.id));
    const submittedItemIds = calculatedRows.filter((row) => row.itemId).map((row) => row.itemId as string);
    if (new Set(submittedItemIds).size !== submittedItemIds.length || submittedItemIds.some((itemId) => !existingItemIds.has(itemId))) return { error: "link" as const };

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
    const removedItemIds = receipt.items.filter((item) => !submittedItemIds.includes(item.id)).map((item) => item.id);
    if (removedItemIds.length) await tx.documentItem.deleteMany({ where: { id: { in: removedItemIds }, documentId: receipt.id } });
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

  const parsedRows = itemIds.map((itemId, index) => {
    const description = String(descriptions[index] ?? "").trim();
    const quantity = String(quantities[index] ?? "").trim();
    const unitPrice = String(unitPrices[index] ?? "").trim();
    const discount = String(discounts[index] ?? "").trim();
    const taxRate = String(taxRates[index] ?? "").trim();
    const hasValue = description || quantity || unitPrice || discount || taxRate;
    if (!hasValue) return null;
    return documentLineSchema.safeParse({ itemId: itemId || undefined, description, quantity, unitPrice, discount, taxRate });
  });
  if (parsedRows.some((row) => row !== null && !row.success)) redirect(`${path}?edit=invalid`);
  const rows = parsedRows.filter((row): row is { success: true; data: z.infer<typeof documentLineSchema> } => row !== null && row.success);

  if (rows.length === 0 || rows.some((row) => row.data.discount > row.data.quantity * row.data.unitPrice)) redirect(`${path}?edit=invalid`);
  const existingItemIds = rows.filter((row) => row.data.itemId).map((row) => row.data.itemId as string);
  if (new Set(existingItemIds).size !== existingItemIds.length) redirect(`${path}?edit=invalid`);

  const existingDocument = await prisma.document.findUnique({ where: { id: documentId }, select: { type: true } });
  const requiredSection = existingDocument ? documentSection(existingDocument.type) : null;
  if (!requiredSection) redirect(`${path}?edit=invalid`);
  await requireSectionAccess(requiredSection);
  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.document.findUnique({ where: { id: documentId }, include: { items: { orderBy: { sortOrder: "asc" } }, payments: { select: { id: true } }, derivedDocuments: { select: { id: true }, where: { type: "INVOICE" } } } });
    if (!document || !["QUOTATION", "INVOICE"].includes(document.type)) return { status: "invalid" as const };
    if (document.type === "QUOTATION" && document.derivedDocuments.length) return { status: "locked" as const };
    if (document.type === "INVOICE" && (document.payments.length || document.invoiceStatus === "VOID")) return { status: "locked" as const };

    const existingDocumentItemIds = new Set(document.items.map((item) => item.id));
    for (const row of rows) {
      if (row.data.itemId && !existingDocumentItemIds.has(row.data.itemId)) return { status: "invalid" as const };
    }
    const selectedCustomer = await resolveCustomer(tx, customerSelection.data);
    if (!selectedCustomer) return { status: "invalid" as const };

    const retainedIds = new Set(rows.map((row) => row.data.itemId).filter((itemId): itemId is string => Boolean(itemId)));
    const removedIds = document.items.filter((item) => !retainedIds.has(item.id)).map((item) => item.id);
    if (removedIds.length) await tx.documentItem.deleteMany({ where: { id: { in: removedIds }, documentId: document.id } });

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

export async function deleteDocumentRecord(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) redirect("/dashboard/quotations?delete=missing");
  const initial = await prisma.document.findUnique({ where: { id: documentId }, select: { type: true } });
  const requiredSection = initial ? documentSection(initial.type) : null;
  if (!requiredSection) redirect("/dashboard/quotations?delete=missing");
  const actor = await requireSectionAccess(requiredSection);

  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.document.findUnique({
      where: { id: documentId },
      include: {
        payment: true,
        payments: { select: { id: true, amount: true } },
        derivedDocuments: { select: { id: true } },
        etims: { select: { id: true } },
      },
    });
    if (!document) return { error: "missing" as const };
    if (document.etims.length) return { error: "tax-record" as const };
    if (document.type !== "RECEIPT" && (document.payments.length || document.derivedDocuments.length)) return { error: "linked" as const };

    if (document.payment) {
      const sourceId = document.payment.documentId;
      await tx.payment.delete({ where: { id: document.payment.id } });
      if (sourceId) {
        const source = await tx.document.findUnique({ where: { id: sourceId }, include: { payments: { select: { amount: true } } } });
        if (source?.type === "INVOICE") {
          const paid = source.payments.reduce((sum, payment) => sum + payment.amount, 0);
          const invoiceStatus = paid >= source.total - 0.005 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "ISSUED";
          await tx.document.update({ where: { id: source.id }, data: { invoiceStatus } });
        }
      }
    }
    await tx.document.delete({ where: { id: document.id } });
    return { error: null as null, id: document.id, number: document.number, type: document.type };
  });

  if (result.error) redirect(`/dashboard/documents/${encodeURIComponent(documentId)}?delete=${result.error}`);
  await prisma.auditLog.create({ data: { actorId: actor.userId, action: "deleted", entityType: result.type, entityId: result.id, summary: `Deleted ${result.type.toLowerCase()} ${result.number}` } });
  revalidatePath("/dashboard/quotations");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/receipts");
  redirect(`/dashboard/${result.type.toLowerCase()}s?deleted=1`);
}

export async function bulkDeleteDocuments(formData: FormData) {
  const typeValue = String(formData.get("documentType") ?? "");
  const type = z.enum(["QUOTATION", "INVOICE", "RECEIPT"]).safeParse(typeValue);
  const requiredSection = type.success ? documentSection(type.data) : null;
  if (!type.success || !requiredSection) redirect("/dashboard/quotations?bulk=invalid");
  const actor = await requireSectionAccess(requiredSection);
  const documentIds = [...new Set(formData.getAll("documentIds").map(String).filter(Boolean))].slice(0, 100);
  const path = `/dashboard/${type.data.toLowerCase()}s`;
  if (!documentIds.length) redirect(`${path}?bulk=none`);

  const result = await prisma.$transaction(async (tx) => {
    const documents = await tx.document.findMany({
      where: { id: { in: documentIds }, type: type.data },
      include: {
        payment: true,
        payments: { select: { amount: true } },
        derivedDocuments: { select: { id: true } },
        etims: { select: { id: true } },
      },
    });
    const deletable = documents.filter((document) => !document.etims.length && (
      document.type === "RECEIPT" || (!document.payments.length && !document.derivedDocuments.length)
    ));
    if (!deletable.length) return { deleted: 0, blocked: documentIds.length };

    const payments = deletable.map((document) => document.payment).filter((payment) => payment !== null);
    const sourceInvoiceIds = [...new Set(payments.map((payment) => payment.documentId).filter((id): id is string => Boolean(id)))];
    if (payments.length) await tx.payment.deleteMany({ where: { id: { in: payments.map((payment) => payment.id) } } });

    for (const sourceId of sourceInvoiceIds) {
      const source = await tx.document.findUnique({ where: { id: sourceId }, include: { payments: { select: { amount: true } } } });
      if (source?.type === "INVOICE") {
        const paid = source.payments.reduce((sum, payment) => sum + payment.amount, 0);
        const invoiceStatus = paid >= source.total - 0.005 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "ISSUED";
        await tx.document.update({ where: { id: source.id }, data: { invoiceStatus } });
      }
    }

    await tx.document.deleteMany({ where: { id: { in: deletable.map((document) => document.id) } } });
    for (const document of deletable) {
      await tx.auditLog.create({ data: { actorId: actor.userId, action: "deleted", entityType: document.type, entityId: document.id, summary: `Deleted ${document.type.toLowerCase()} ${document.number}` } });
    }
    return { deleted: deletable.length, blocked: documentIds.length - deletable.length };
  });

  revalidatePath("/dashboard/quotations");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/receipts");
  redirect(`${path}?bulk=deleted&count=${result.deleted}&blocked=${result.blocked}`);
}

export async function createStaffAccount(formData: FormData) {
  const actor = await requireStaffManagementSession();
  const parsed = staffAccountSchema.safeParse(Object.fromEntries(formData));
  const sections = parseStaffSections(formData);
  if (!parsed.success || !sections) redirect("/dashboard/settings?staff=invalid");

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
        sectionAccess: sections,
        roles: { create: { roleId: role.id } },
      },
      select: { id: true, name: true, email: true },
    });
    await prisma.auditLog.create({
      data: { actorId: actor.userId, action: "created", entityType: "User", entityId: staff.id, summary: `Created staff account for ${staff.email}`, metadata: { sectionAccess: sections } },
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
  const actor = await requireStaffManagementSession();
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

export async function updateStaffSections(formData: FormData) {
  const actor = await requireStaffManagementSession();
  const userId = String(formData.get("userId") ?? "");
  const sections = parseStaffSections(formData);
  if (!userId || userId === actor.userId || !sections) redirect("/dashboard/settings?staff=invalid");

  const staff = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, roles: { select: { role: { select: { name: true } } } } },
  });
  if (!staff || staff.roles.some(({ role }) => role.name === adminRoleName)) redirect("/dashboard/settings?staff=invalid");

  await prisma.user.update({ where: { id: staff.id }, data: { sectionAccess: sections } });
  await prisma.auditLog.create({
    data: { actorId: actor.userId, action: "updated", entityType: "User", entityId: staff.id, summary: `Updated portal sections for ${staff.email}`, metadata: { sectionAccess: sections } },
  });
  redirect("/dashboard/settings?staff=sections");
}

export async function resetStaffPassword(formData: FormData) {
  const actor = await requireStaffManagementSession();
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
  await requireSectionAccess("prospects");
  const parsed = prospectStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/prospects?error=invalid");
  await prisma.prospect.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
  redirect("/dashboard/prospects?updated=1");
}

export async function createFinding(formData: FormData) {
  const session = await requireSectionAccess("findings");
  const parsed = findingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/findings?error=invalid");
  const finding = await prisma.finding.create({ data: parsed.data });
  await prisma.auditLog.create({ data: { actorId: session.userId, action: "created", entityType: "Finding", entityId: finding.id, summary: `Recorded finding: ${finding.title}` } });
  redirect("/dashboard/findings?created=1");
}

export async function updateFindingStatus(formData: FormData) {
  await requireSectionAccess("findings");
  const parsed = findingStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/findings?error=invalid");
  await prisma.finding.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
  redirect("/dashboard/findings?updated=1");
}

export async function createPortfolioProject(formData: FormData) {
  const session = await requireSectionAccess("portfolio");
  const parsed = portfolioProjectSchema.safeParse({ ...Object.fromEntries(formData), category: formData.getAll("category") });
  if (!parsed.success) redirect("/dashboard/portfolio?error=invalid");
  const media = await preparePortfolioMedia(formData, session.userId);
  if (!media) redirect("/dashboard/portfolio?error=media");
  const project = await prisma.portfolioProject.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category.join(", "),
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
  const session = await requireSectionAccess("portfolio");
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
  await requireSectionAccess("portfolio");
  const parsed = portfolioProjectStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/portfolio?error=invalid");
  await prisma.portfolioProject.update({ where: { id: parsed.data.id }, data: { isPublished: parsed.data.isPublished === "true" } });
  revalidatePath("/portfolio");
  redirect("/dashboard/portfolio?updated=1");
}

export async function deletePortfolioProject(formData: FormData) {
  const actor = await requireSectionAccess("portfolio");
  const parsed = portfolioProjectDeleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/dashboard/portfolio?error=invalid");

  const project = await prisma.portfolioProject.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, title: true },
  });
  if (!project) redirect("/dashboard/portfolio?error=notfound");

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "deleted",
        entityType: "PortfolioProject",
        entityId: project.id,
        summary: `Deleted portfolio project ${project.title}`,
      },
    }),
    prisma.portfolioProject.delete({ where: { id: project.id } }),
  ]);

  revalidatePath("/portfolio");
  revalidatePath("/dashboard/portfolio");
  redirect("/dashboard/portfolio?deleted=1");
}

export async function deletePortfolioProjects(formData: FormData) {
  const actor = await requireSectionAccess("portfolio");
  const mode = formData.get("mode");
  if (mode !== "selected" && mode !== "all") redirect("/dashboard/portfolio?error=invalid");

  let projects: { id: string; title: string }[];
  if (mode === "all") {
    projects = await prisma.portfolioProject.findMany({ select: { id: true, title: true } });
  } else {
    const submittedIds = formData.getAll("projectIds");
    if (submittedIds.some((id) => typeof id !== "string" || id.length === 0)) redirect("/dashboard/portfolio?error=invalid");
    const ids = [...new Set(submittedIds as string[])];
    if (ids.length === 0) redirect("/dashboard/portfolio?error=invalid");
    projects = await prisma.portfolioProject.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
    if (projects.length !== ids.length) redirect("/dashboard/portfolio?error=notfound");
  }

  if (projects.length > 0) {
    await prisma.$transaction([
      ...projects.map((project) => prisma.auditLog.create({
        data: { actorId: actor.userId, action: "deleted", entityType: "PortfolioProject", entityId: project.id, summary: `Deleted portfolio project ${project.title}` },
      })),
      prisma.portfolioProject.deleteMany({ where: { id: { in: projects.map((project) => project.id) } } }),
    ]);
  }

  revalidatePath("/portfolio");
  revalidatePath("/dashboard/portfolio");
  redirect(`/dashboard/portfolio?deleted=${projects.length}`);
}

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const companyProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: optionalText(300),
  email: z.union([z.literal(""), z.email()]).transform((value) => value || null),
  phone: optionalText(40),
  quotePrefix: z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9-]+$/),
  defaultTaxRate: z.coerce.number().min(0).max(100),
  quoteValidityDays: z.coerce.number().int().min(1).max(365),
});

export async function updateCompanyProfile(formData: FormData) {
  const actor = await requireSectionAccess("company-profile");
  const parsed = companyProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings?profile=invalid");
  const { name, address, email, phone, quotePrefix, defaultTaxRate, quoteValidityDays } = parsed.data;

  await prisma.$transaction([
    prisma.companySettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.companyProfile.upsert({ where: { companyId: 1 }, create: { companyId: 1, name, address, email, phone }, update: { name, address, email, phone } }),
    prisma.documentSettings.upsert({ where: { companyId: 1 }, create: { companyId: 1, quotePrefix, defaultTaxRate, quoteValidityDays }, update: { quotePrefix, defaultTaxRate, quoteValidityDays } }),
  ]);
  await prisma.auditLog.create({
    data: { actorId: actor.userId, action: "updated", entityType: "CompanyProfile", entityId: "1", summary: `Updated company profile for ${name}` },
  });
  revalidatePath("/", "layout");
  redirect("/dashboard/settings?profile=saved");
}

const whatsappSchema = z.object({
  number: z.string().trim().max(40),
  message: z.string().trim().max(500),
});

export async function updateWhatsappSettings(formData: FormData) {
  const actor = await requirePrototypeAdminSession();
  const parsed = whatsappSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings?whatsapp=invalid");

  // An empty number restores the published company contact number fallback.
  const number = parsed.data.number === "" ? null : normalizeWhatsappNumber(parsed.data.number);
  if (parsed.data.number !== "" && !number) redirect("/dashboard/settings?whatsapp=invalid");

  await prisma.companyProfile.update({ where: { companyId: 1 }, data: { whatsappNumber: number, whatsappMessage: parsed.data.message || null } });
  await prisma.auditLog.create({
    data: { actorId: actor.userId, action: "updated", entityType: "CompanyProfile", entityId: "1", summary: number ? `Set WhatsApp number to ${number}` : "Reset WhatsApp number to the published company contact" },
  });
  revalidatePath("/", "layout");
  redirect("/dashboard/settings?whatsapp=saved");
}
