"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const prospectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.union([z.literal(""), z.email()]).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  serviceInterest: z.array(z.enum(["Power Solutions", "Solar Solutions", "Borehole Solutions"])).max(3).optional(),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(200).optional(),
});

export async function submitWebsiteEnquiry(formData: FormData) {
  const submission: Record<string, unknown> = Object.fromEntries(formData);
  submission.serviceInterest = formData.getAll("serviceInterest");
  const parsed = prospectSchema.safeParse(submission);
  if (!parsed.success) redirect("/?contact=invalid#contact");
  if (parsed.data.website) redirect("/?contact=sent#contact");

  try {
    await prisma.prospect.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        company: parsed.data.company || null,
        serviceInterest: parsed.data.serviceInterest?.join(", ") || null,
        message: parsed.data.message,
      },
    });
  } catch (error) {
    console.error("Unable to save website enquiry", error);
    redirect("/?contact=failed#contact");
  }
  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard");
  redirect("/?contact=sent#contact");
}
