import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const cookieName = "northstar_staff_session";
const sessionLifetimeSeconds = 60 * 60 * 8;
const adminRoleName = "Prototype administrator";
const scryptKeyLength = 64;

export type StaffSession = { userId: string; email: string; sessionVersion: number };

function sign(value: string) {
  return createHmac("sha256", env.PROTOTYPE_SESSION_SECRET).update(value).digest("base64url");
}

function secureStringEquals(submitted: string, expected: string) {
  const submittedBytes = Buffer.from(submitted);
  const expectedBytes = Buffer.from(expected);
  return submittedBytes.length === expectedBytes.length && timingSafeEqual(submittedBytes, expectedBytes);
}

export function hashStaffPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, scryptKeyLength).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyStaffPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHex, extra] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex || extra) return false;

  try {
    const actual = scryptSync(password, salt, scryptKeyLength);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function authenticateStaff(email: string, password: string): Promise<StaffSession | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      status: true,
      passwordHash: true,
      sessionVersion: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!user || user.status !== "ACTIVE") return null;

  const isAdmin = user.roles.some(({ role }) => role.name === adminRoleName);
  const authenticated = normalizedEmail === env.PROTOTYPE_ADMIN_EMAIL.toLowerCase()
    ? isAdmin && secureStringEquals(password, env.PROTOTYPE_ADMIN_PASSWORD)
    : Boolean(user.passwordHash && verifyStaffPassword(password, user.passwordHash));

  return authenticated ? { userId: user.id, email: user.email, sessionVersion: user.sessionVersion } : null;
}

export async function createPrototypeSession(session: StaffSession) {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
  const payload = Buffer.from(JSON.stringify({ ...session, expiresAt })).toString("base64url");
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

export async function getPrototypeSession(): Promise<StaffSession | null> {
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
      typeof parsed !== "object" || parsed === null ||
      !("userId" in parsed) || typeof parsed.userId !== "string" ||
      !("email" in parsed) || typeof parsed.email !== "string" ||
      !("sessionVersion" in parsed) || typeof parsed.sessionVersion !== "number" || !Number.isInteger(parsed.sessionVersion) ||
      !("expiresAt" in parsed) || typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;

    const user = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, email: true, status: true, sessionVersion: true },
    });
    if (!user || user.status !== "ACTIVE" || user.email !== parsed.email || user.sessionVersion !== parsed.sessionVersion) return null;
    return { userId: user.id, email: user.email, sessionVersion: user.sessionVersion };
  } catch {
    return null;
  }
}

export async function requirePrototypeSession() {
  const session = await getPrototypeSession();
  if (!session) redirect("/login");
  return session;
}

export async function requirePrototypeAdminSession() {
  const session = await requirePrototypeSession();
  if (!await isPrototypeAdministrator(session.userId)) redirect("/dashboard?error=forbidden");
  return session;
}

export async function isPrototypeAdministrator(userId: string) {
  const adminRole = await prisma.userRole.findFirst({
    where: { userId, role: { name: adminRoleName } },
    select: { role: { select: { name: true } } },
  });
  return adminRole?.role.name === adminRoleName;
}

export async function clearPrototypeSession() {
  (await cookies()).delete(cookieName);
}
