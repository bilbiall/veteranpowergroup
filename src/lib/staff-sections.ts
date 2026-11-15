export const staffSections = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", group: "Workspace" },
  { key: "customers", label: "Customers", href: "/dashboard/customers", group: "Workspace" },
  { key: "prospects", label: "Customer enquiries", href: "/dashboard/prospects", group: "Workspace" },
  { key: "quotations", label: "Quotations", href: "/dashboard/quotations", group: "Finance" },
  { key: "invoices", label: "Invoices", href: "/dashboard/invoices", group: "Finance" },
  { key: "receipts", label: "Receipts", href: "/dashboard/receipts", group: "Finance" },
  { key: "payment-plans", label: "School payment templates", href: "/dashboard/payment-plans", group: "Finance" },
  { key: "analytics", label: "Website analytics", href: "/dashboard/analytics", group: "Insights" },
  { key: "reports", label: "Reports", href: "/dashboard/reports", group: "Insights" },
  { key: "findings", label: "Findings", href: "/dashboard/findings", group: "Insights" },
  { key: "portfolio", label: "Portfolio", href: "/dashboard/portfolio", group: "Insights" },
  { key: "settings", label: "Settings", href: "/dashboard/settings", group: "Manage" },
] as const;

export const staffPermissions = [
  { key: "company-profile", label: "Edit company profile", group: "Manage" },
  { key: "manage-staff", label: "Staff accounts", group: "Access" },
  { key: "report-summary", label: "Reports summary", group: "Reports" },
  { key: "report-findings", label: "Findings", group: "Reports" },
  { key: "report-analytics", label: "Analytics", group: "Reports" },
  { key: "report-prospects", label: "Prospects", group: "Reports" },
  { key: "report-receipts", label: "Receipts", group: "Reports" },
  { key: "report-quotations", label: "Quotations", group: "Reports" },
  { key: "report-invoices", label: "Invoices", group: "Reports" },
  { key: "report-audit-trail", label: "Login and change audit trail", group: "Reports" },
] as const;

export type StaffSectionKey = (typeof staffSections)[number]["key"];
export type StaffPermissionKey = (typeof staffPermissions)[number]["key"];
export type StaffAccessKey = StaffSectionKey | StaffPermissionKey;

export const staffSectionKeys: StaffSectionKey[] = staffSections.map((section) => section.key);
export const staffAccessKeys: StaffAccessKey[] = [...staffSectionKeys, ...staffPermissions.map((permission) => permission.key)];
const staffAccessOptions = [...staffSections, ...staffPermissions];

export const staffSectionGroups = [...new Set(staffSections.map((section) => section.group))].map((group) => ({
  group,
  sections: staffSections.filter((section) => section.group === group),
}));

export const staffAccessGroups = [...new Set(staffAccessOptions.map((option) => option.group))].map((group) => ({
  group,
  options: staffAccessOptions.filter((option) => option.group === group),
}));

export function isStaffSectionKey(value: unknown): value is StaffSectionKey {
  return typeof value === "string" && (staffSectionKeys as string[]).includes(value);
}

export function isStaffAccessKey(value: unknown): value is StaffAccessKey {
  return typeof value === "string" && (staffAccessKeys as string[]).includes(value);
}

export function staffAccessLabels(keys: readonly string[]) {
  return staffAccessOptions.filter((option) => keys.includes(option.key)).map((option) => option.label);
}

export function documentSection(type: string): StaffSectionKey | null {
  return type === "QUOTATION" ? "quotations" : type === "INVOICE" ? "invoices" : type === "RECEIPT" ? "receipts" : null;
}

export function firstAllowedHref(access: readonly StaffAccessKey[]) {
  return staffSections.find((section) => access.includes(section.key))?.href ?? null;
}

export const reportAccessKeys = staffPermissions.filter(({ key }) => key.startsWith("report-")).map(({ key }) => key);
export const allDataReportAccessKeys = ["report-summary", "report-analytics", "report-prospects", "report-receipts", "report-quotations", "report-invoices"] as const;

export function canDownloadAllData(access: readonly StaffAccessKey[]) {
  return allDataReportAccessKeys.every((key) => access.includes(key));
}
