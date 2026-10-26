import { prisma } from "@/lib/prisma";

export async function getCompanyProfileSummary() {
  try {
    return await prisma.companyProfile.findUnique({
      where: { companyId: 1 },
      select: { address: true, whatsappNumber: true, whatsappMessage: true },
    });
  } catch {
    return null;
  }
}
