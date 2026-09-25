import { DashboardShell } from "@/components/dashboard-shell";
import { requirePrototypeSession } from "@/lib/prototype-auth";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await requirePrototypeSession();
  return <DashboardShell>{children}</DashboardShell>;
}
