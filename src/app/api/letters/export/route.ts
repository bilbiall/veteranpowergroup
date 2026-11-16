import { z } from "zod";
import { buildLetterheadExport, type LetterheadFormat } from "@/lib/letterhead-exports";
import { getPrototypeSession, getStaffAccess } from "@/lib/prototype-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const requestSchema = z.object({
  content: z.string().max(40000),
  format: z.enum(["docx", "xlsx", "pdf"]),
});

const contentTypes: Record<LetterheadFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export async function POST(request: Request) {
  const session = await getPrototypeSession();
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });

  const access = await getStaffAccess(session.userId);
  if (!access.sections.includes("letters")) return Response.json({ error: "Access denied" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose a format and keep letter content under 40,000 characters." }, { status: 400 });

  const company = await prisma.companyProfile.findUnique({
    where: { companyId: 1 },
    select: { name: true, address: true, email: true, phone: true, taxInformation: true },
  });
  const content = await buildLetterheadExport(parsed.data.content, parsed.data.format, {
    name: company?.name ?? "Veteran Power Solutions Limited",
    address: company?.address ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    taxInformation: company?.taxInformation ?? "",
  });

  return new Response(Uint8Array.from(content), {
    headers: {
      "Content-Type": contentTypes[parsed.data.format],
      "Content-Disposition": `attachment; filename="Veteran-Power-Solutions-letter.${parsed.data.format}"`,
      "Content-Length": String(content.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
