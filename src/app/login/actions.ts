"use server";

import { redirect } from "next/navigation";
import { clearPrototypeSession, createPrototypeSession, verifyPrototypeCredentials } from "@/lib/prototype-auth";

export async function login(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !verifyPrototypeCredentials(email, password)) {
    redirect("/login?error=invalid");
  }

  await createPrototypeSession(email);
  redirect("/dashboard");
}

export async function logout() {
  await clearPrototypeSession();
  redirect("/login");
}
