import { isPortfolioMediaType } from "@/lib/portfolio-media";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function rangeNotSatisfiable(size: number) {
  return new Response(null, {
    status: 416,
    headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await prisma.media.findUnique({
    where: { id },
    select: { url: true, mimeType: true, portfolioProject: { select: { isPublished: true } } },
  });
  if (!media?.portfolioProject?.isPublished || !media.mimeType || !isPortfolioMediaType(media.mimeType)) return new Response(null, { status: 404 });

  const dataUrlPrefix = `data:${media.mimeType};base64,`;
  if (!media.url.startsWith(dataUrlPrefix)) return new Response(null, { status: 404 });
  const encodedContent = media.url.slice(dataUrlPrefix.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedContent)) return new Response(null, { status: 404 });

  const content = Buffer.from(encodedContent, "base64");
  const size = content.byteLength;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "Content-Type": media.mimeType,
    "X-Content-Type-Options": "nosniff",
  });
  const range = request.headers.get("range");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (!match[1] && !match[2])) return rangeNotSatisfiable(size);
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[2] && match[1] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return rangeNotSatisfiable(size);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(Uint8Array.from(content.subarray(start, end + 1)), { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(Uint8Array.from(content), { headers });
}