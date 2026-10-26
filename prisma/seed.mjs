import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const year = new Date().getFullYear();
if (!process.env.PROTOTYPE_ADMIN_EMAIL) {
  throw new Error("Set PROTOTYPE_ADMIN_EMAIL in .env before seeding the database.");
}

const adminEmail = process.env.PROTOTYPE_ADMIN_EMAIL.toLowerCase();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: { name: "Veteran Demo Admin", email: adminEmail },
    update: { name: "Veteran Demo Admin" },
  });

  const role = await prisma.role.upsert({ where: { name: "Prototype administrator" }, create: { name: "Prototype administrator", description: "Local prototype role; replace with agreed production access rules." }, update: {} });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: role.id } }, create: { userId: admin.id, roleId: role.id }, update: {} });

  const permissions = ["customers.read", "customers.write", "documents.read", "documents.write"];
  for (const key of permissions) {
    const permission = await prisma.permission.upsert({ where: { key }, create: { key, description: `Prototype permission: ${key}` }, update: {} });
    await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, create: { roleId: role.id, permissionId: permission.id }, update: {} });
  }

  await prisma.companySettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  await prisma.companyProfile.upsert({ where: { companyId: 1 }, create: { companyId: 1, name: "Veteran Power Solutions Limited", email: "veteranpowergroup@gmail.com", phone: "+254707734670", whatsappNumber: "254707734670", address: "Shem Plaza, Lusaka Road, Industrial Area, Nairobi, Opposite ASL" }, update: { name: "Veteran Power Solutions Limited", email: "veteranpowergroup@gmail.com", phone: "+254707734670", address: "Shem Plaza, Lusaka Road, Industrial Area, Nairobi, Opposite ASL" } });
  await prisma.documentSettings.upsert({ where: { companyId: 1 }, create: { companyId: 1, quotePrefix: "QUO", invoicePrefix: "INV", receiptPrefix: "REC", defaultTaxRate: 0, quoteValidityDays: 30, terms: "Prototype terms — replace before use." }, update: {} });
  await prisma.branding.upsert({ where: { companyId: 1 }, create: { companyId: 1 }, update: {} });
  await prisma.websiteAppearance.upsert({ where: { companyId: 1 }, create: { companyId: 1 }, update: {} });

  const sampleCustomers = [
    { id: "sample-customer-aster", name: "Samira Njoroge", company: "Aster & Vale", email: "samira@aster.example.invalid", phone: "+254 700 000 101" },
    { id: "sample-customer-field", name: "Daniel Otieno", company: "Fieldwork Studio", email: "daniel@fieldwork.example.invalid", phone: "+254 700 000 102" },
    { id: "sample-customer-alpine", name: "Amina Hassan", company: "Alpine Logistics Demo", email: "amina@alpine.example.invalid", phone: "+254 700 000 103" },
  ];
  for (const customer of sampleCustomers) {
    await prisma.customer.upsert({ where: { id: customer.id }, create: customer, update: { name: customer.name, company: customer.company, email: customer.email, phone: customer.phone } });
  }

  const quote = await prisma.document.upsert({
    where: { number: `QUO-${year}-0001` },
    create: {
      id: "sample-quotation-0001", number: `QUO-${year}-0001`, type: "QUOTATION", quotationStatus: "DRAFT",
      subtotal: 28500, tax: 0, total: 28500, customerId: "sample-customer-aster", ownerId: admin.id,
      companyId: 1, sequenceYear: year, sequenceValue: 1,
      items: { create: [{ description: "Operations discovery workshop (sample)", quantity: 1, unitPrice: 18000, amount: 18000, total: 18000, sortOrder: 0 }, { description: "Process mapping (sample)", quantity: 3, unitPrice: 3500, amount: 10500, total: 10500, sortOrder: 1 }] },
    },
    update: {},
  });
  const invoice = await prisma.document.upsert({
    where: { number: `INV-${year}-0001` },
    create: { id: "sample-invoice-0001", number: `INV-${year}-0001`, type: "INVOICE", invoiceStatus: "ISSUED", subtotal: 42000, tax: 0, total: 42000, customerId: "sample-customer-field", ownerId: admin.id, companyId: 1, sequenceYear: year, sequenceValue: 1, items: { create: { description: "Systems design sprint (sample)", quantity: 1, unitPrice: 42000, amount: 42000, total: 42000 } } },
    update: {},
  });
  const receipt = await prisma.document.upsert({
    where: { number: `REC-${year}-0001` },
    create: { id: "sample-receipt-0001", number: `REC-${year}-0001`, type: "RECEIPT", receiptStatus: "ISSUED", subtotal: 12500, tax: 0, total: 12500, customerId: "sample-customer-alpine", sourceDocumentId: invoice.id, ownerId: admin.id, companyId: 1, sequenceYear: year, sequenceValue: 1 },
    update: {},
  });

  for (const [type, prefix] of [["QUOTATION", "QUO"], ["INVOICE", "INV"], ["RECEIPT", "REC"]]) {
    await prisma.documentNumberSequence.upsert({
      where: { companyId_type_year: { companyId: 1, type, year } },
      create: { companyId: 1, type, year, prefix, nextValue: 2 },
      update: {},
    });
  }

  const activity = [
    { id: "sample-audit-quote", entityType: "Quotation", entityId: quote.id, summary: `Created sample draft ${quote.number}` },
    { id: "sample-audit-invoice", entityType: "Invoice", entityId: invoice.id, summary: `Added sample invoice ${invoice.number}` },
    { id: "sample-audit-receipt", entityType: "Receipt", entityId: receipt.id, summary: `Added sample receipt ${receipt.number}` },
  ];
  for (const entry of activity) {
    await prisma.auditLog.upsert({ where: { id: entry.id }, create: { ...entry, actorId: admin.id, action: "seeded", reason: "Fictional prototype sample data" }, update: {} });
  }

  console.info("Prototype sample data is ready. All seeded records are fictional.");
}

main().catch((error) => {
  console.error("Could not seed the prototype database.", error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
