"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePrototypeSession } from "@/lib/prototype-auth";

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
