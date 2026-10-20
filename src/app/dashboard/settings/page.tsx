import { createStaffAccount, resetStaffPassword, setStaffStatus, updateWhatsappSettings } from "@/app/dashboard/actions";
import { prisma } from "@/lib/prisma";
import { isPrototypeAdministrator, requirePrototypeSession } from "@/lib/prototype-auth";
import { defaultWhatsappMessage } from "@/lib/whatsapp";

const whatsappMessages: Record<string, string> = {
  saved: "WhatsApp settings saved. The button on the website is updated.",
  invalid: "Enter a valid phone number, for example 0707 734 670 or +254 707 734 670.",
};

const staffMessages: Record<string, string> = {
  created: "Staff account created. Share its initial password securely.",
  exists: "An account already uses that email address.",
  invalid: "Check the account details and password length, then try again.",
  updated: "Staff account access updated.",
  "password-reset": "Staff password reset. Share the new password securely.",
};

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const session = await requirePrototypeSession();
  const params = await searchParams;
  const staffMessageKey = Array.isArray(params.staff) ? params.staff[0] : params.staff;
  const staffMessage = staffMessageKey ? staffMessages[staffMessageKey] : undefined;
  const whatsappKey = Array.isArray(params.whatsapp) ? params.whatsapp[0] : params.whatsapp;
  const whatsappFeedback = whatsappKey ? whatsappMessages[whatsappKey] : undefined;
  const canManageStaff = await isPrototypeAdministrator(session.userId);
  const [company, staffUsers] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 }, include: { profile: true, documents: true, websiteAppearance: true } }),
    canManageStaff ? prisma.user.findMany({
      where: { roles: { some: { role: { name: "Prototype staff" } } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    }) : Promise.resolve([]),
  ]);

  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Manage</p><h1>Prototype settings</h1><p className="dashboard-note">These defaults are placeholders until the company requirements arrive.</p></div><span className="prototype-badge">Provisional</span></header>
    <section className="panel table-panel settings-panel">
      <div className="panel-heading"><div><p className="eyebrow">Company profile</p><h3>{company?.profile?.name ?? "Not configured"}</h3></div></div>
      <dl className="settings-list"><div><dt>Address</dt><dd>{company?.profile?.address ?? "Not configured"}</dd></div><div><dt>Email</dt><dd>{company?.profile?.email ?? "Not configured"}</dd></div><div><dt>Phone</dt><dd>{company?.profile?.phone ?? "Not configured"}</dd></div><div><dt>Quotation prefix</dt><dd>{company?.documents?.quotePrefix ?? "Not configured"}</dd></div><div><dt>Default tax rate</dt><dd>{company?.documents?.defaultTaxRate ?? 0}%</dd></div><div><dt>Quotation validity</dt><dd>{company?.documents?.quoteValidityDays ?? "Not configured"} days</dd></div><div><dt>Currency</dt><dd>Awaiting requirements</dd></div></dl>
    </section>

    {canManageStaff && <section className="panel table-panel">
      <div className="panel-heading"><div><p className="eyebrow">Website</p><h3>WhatsApp button</h3><p className="dashboard-note">A floating button on the public website opens WhatsApp to this number with the preset message. Leave the number empty to hide the button.</p></div><span className="prototype-badge">Administrator</span></div>
      {whatsappFeedback && <p className={`staff-feedback${whatsappKey === "invalid" ? " is-error" : ""}`} role="status">{whatsappFeedback}</p>}
      <form action={updateWhatsappSettings} className="prototype-form whatsapp-settings-form">
        <label>WhatsApp number<input name="number" type="tel" inputMode="tel" maxLength={40} defaultValue={company?.profile?.whatsappNumber ? `+${company.profile.whatsappNumber}` : ""} placeholder="+254 707 734 670" /><span>Numbers starting with 0 are treated as Kenyan (+254).</span></label>
        <label className="whatsapp-message-field">Preset message<textarea name="message" maxLength={500} defaultValue={company?.profile?.whatsappMessage ?? defaultWhatsappMessage} /></label>
        <button className="dashboard-button" type="submit">Save WhatsApp settings</button>
      </form>
    </section>}

    {canManageStaff && <section className="panel table-panel staff-management">
      <div className="panel-heading"><div><p className="eyebrow">Access</p><h3>Staff accounts</h3><p className="dashboard-note">Create individual sign-ins, reset passwords, or disable access.</p></div><span className="prototype-badge">Administrator</span></div>
      {staffMessage && <p className={`staff-feedback${staffMessageKey === "invalid" || staffMessageKey === "exists" ? " is-error" : ""}`} role="status">{staffMessage}</p>}
      <form action={createStaffAccount} className="prototype-form staff-create-form">
        <label>Staff name<input name="name" autoComplete="name" minLength={2} maxLength={120} required /></label>
        <label>Work email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Temporary password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><span>At least 12 characters. Share it with the staff member securely.</span></label>
        <button className="dashboard-button" type="submit">Create staff account</button>
      </form>

      <div className="table-scroll staff-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Created</th><th>Access</th><th>Password</th></tr></thead><tbody>
        {staffUsers.length === 0 ? <tr><td colSpan={6}>No staff accounts have been created.</td></tr> : staffUsers.map((staff) => <tr key={staff.id}>
          <td>{staff.name}</td><td>{staff.email}</td><td><span className={`account-status ${staff.status === "ACTIVE" ? "is-active" : "is-disabled"}`}>{staff.status === "ACTIVE" ? "Active" : "Disabled"}</span></td><td>{staff.createdAt.toLocaleDateString("en")}</td>
          <td><form action={setStaffStatus}><input type="hidden" name="userId" value={staff.id} /><input type="hidden" name="status" value={staff.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} /><button className="staff-action" type="submit">{staff.status === "ACTIVE" ? "Disable" : "Enable"}</button></form></td>
          <td><details className="reset-password"><summary>Reset</summary><form action={resetStaffPassword}><input type="hidden" name="userId" value={staff.id} /><label className="sr-only" htmlFor={`password-${staff.id}`}>New password for {staff.name}</label><input id={`password-${staff.id}`} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder="12+ characters" required /><button className="staff-action" type="submit">Set password</button></form></details></td>
        </tr>)}
      </tbody></table></div>
      <p className="dashboard-note staff-security-note">Disabled accounts lose access immediately. The administrator account configured in .env is managed separately and cannot be disabled here.</p>
    </section>}
  </main>;
}
