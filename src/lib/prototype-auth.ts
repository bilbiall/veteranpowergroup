import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

const cookieName = "northstar_prototype_session";
const sessionLifetimeSeconds = 60 * 60 * 8;

type PrototypeSession = { email: string; expiresAt: number };

function sign(value: string) {
  return createHmac("sha256", env.PROTOTYPE_SESSION_SECRET).update(value).digest("base64url");
}

export function verifyPrototypeCredentials(email: string, password: string) {
  const submittedEmail = Buffer.from(email.trim().toLowerCase());
  const expectedEmail = Buffer.from(env.PROTOTYPE_ADMIN_EMAIL.toLowerCase());
  const submittedPassword = Buffer.from(password);
  const expectedPassword = Buffer.from(env.PROTOTYPE_ADMIN_PASSWORD);

  return submittedEmail.length === expectedEmail.length
    && timingSafeEqual(submittedEmail, expectedEmail)
    && submittedPassword.length === expectedPassword.length
    && timingSafeEqual(submittedPassword, expectedPassword);
}

export async function createPrototypeSession(email: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
  const payload = Buffer.from(JSON.stringify({ email: email.toLowerCase(), expiresAt } satisfies PrototypeSession)).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();

  cookieStore.set(cookieName, value, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionLifetimeSeconds,
  });
}

export async function getPrototypeSession(): Promise<PrototypeSession | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;

  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" && parsed !== null &&
      "email" in parsed && typeof parsed.email === "string" &&
      "expiresAt" in parsed && typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Math.floor(Date.now() / 1000) &&
      parsed.email === env.PROTOTYPE_ADMIN_EMAIL.toLowerCase()
    ) {
      return { email: parsed.email, expiresAt: parsed.expiresAt };
    }
  } catch {
    return null;
  }

  return null;
}

export async function requirePrototypeSession() {
  const session = await getPrototypeSession();
  if (!session) redirect("/login");
  return session;
}

export async function clearPrototypeSession() {
  (await cookies()).delete(cookieName);
}
