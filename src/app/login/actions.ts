"use server";

import { redirect } from "next/navigation";
import { authenticateStaff, clearPrototypeSession, createPrototypeSession } from "@/lib/prototype-auth";
import { prisma } from "@/lib/prisma";

export async function login(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/login?error=invalid");
  }

  const staff = await authenticateStaff(email, password);
  if (!staff) redirect("/login?error=invalid");

  await prisma.auditLog.create({ data: { actorId: staff.userId, action: "login", entityType: "User", entityId: staff.userId, summary: "Logged in to the staff portal" } });
  await createPrototypeSession(staff);
  redirect("/dashboard");
}

export async function logout() {
  await clearPrototypeSession();
  redirect("/login");
}
