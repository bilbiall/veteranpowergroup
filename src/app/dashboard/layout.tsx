import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { prisma } from "@/lib/prisma";
import { requirePrototypeSession } from "@/lib/prototype-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await requirePrototypeSession();
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } });
  if (!user) redirect("/login");
  return <DashboardShell staff={user}>{children}</DashboardShell>;
}
