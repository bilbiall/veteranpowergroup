import { z } from "zod";
import { prisma } from "@/lib/prisma";

const visitSchema = z.object({
  path: z.string().min(1).max(180).refine((value) => value.startsWith("/") && !value.startsWith("//")),
  referrer: z.string().max(500).nullable().optional(),
});

export async function POST(request: Request) {
  if (process.env.APP_SURFACE !== "website") return new Response(null, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = visitSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  let referrer: string | null = null;
  if (parsed.data.referrer) {
    try {
      const url = new URL(parsed.data.referrer);
      if (url.protocol === "http:" || url.protocol === "https:") referrer = url.origin;
    } catch {
      referrer = null;
    }
  }

  await prisma.websiteVisit.create({ data: { path: parsed.data.path, referrer } });
  return new Response(null, { status: 204 });
}
