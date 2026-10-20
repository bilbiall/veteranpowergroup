import type { NextRequest } from "next/server";
import { buildDocumentExport, ExportFormat } from "@/lib/document-exports";
import { findExportDocument } from "@/lib/document-export-data";
import { getPrototypeSession } from "@/lib/prototype-auth";
import { withApiErrorHandling } from "@/lib/http";

export const runtime = "nodejs";

const contentTypes: Record<ExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export const GET = withApiErrorHandling(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const session = await getPrototypeSession();
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });

  const format = request.nextUrl.searchParams.get("format");
  if (format !== "docx" && format !== "xlsx" && format !== "pdf") {
    return Response.json({ error: "Choose docx, xlsx, or pdf" }, { status: 400 });
  }

  const { id } = await context.params;
  const document = await findExportDocument(id);
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });

  const content = await buildDocumentExport(document, format);
  const safeNumber = document.number.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new Response(Uint8Array.from(content), {
    headers: {
      "Content-Type": contentTypes[format],
      "Content-Disposition": `attachment; filename="${safeNumber}.${format}"`,
      "Content-Length": String(content.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
