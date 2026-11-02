import { createStaffAccount, resetStaffPassword, setStaffStatus, updateCompanyProfile, updateStaffSections, updateWhatsappSettings } from "@/app/dashboard/actions";
import { prisma } from "@/lib/prisma";
import { getStaffAccess, requireSectionAccess } from "@/lib/prototype-auth";
import { defaultWhatsappMessage, defaultWhatsappNumber } from "@/lib/whatsapp";
import { staffAccessGroups, staffAccessKeys, staffAccessLabels, type StaffAccessKey } from "@/lib/staff-sections";

function SectionCheckboxes({ selected = [] }: { selected?: readonly StaffAccessKey[] }) {
  return <fieldset className="staff-sections"><legend className="sr-only">Staff portal access</legend>{staffAccessGroups.map(({ group, options }) => <div className="staff-section-group" key={group}><strong>{group}</strong>{options.map((option) => <label className="checkbox-label" key={option.key}><input type="checkbox" name="sections" value={option.key} defaultChecked={selected.includes(option.key)} />{option.label}</label>)}</div>)}</fieldset>;
}

function sectionSummary(keys: readonly string[]) {
  return staffAccessLabels(keys).join(", ") || "No sections assigned";
}

const staffMessages: Record<string, string> = { created: "Staff account created. Share its initial password securely.", exists: "An account already uses that email address.", invalid: "Check the account details, assigned sections, and password length.", updated: "Staff account access updated.", sections: "Staff section access saved.", "password-reset": "Staff password reset. Share the new password securely." };
const profileMessages: Record<string, string> = { saved: "Company profile saved.", invalid: "Check the company details and try again." };
const whatsappMessages: Record<string, string> = { saved: "WhatsApp settings saved. The button on the website is updated.", invalid: "Enter a valid phone number, for example 0707 734 670 or +254 707 734 670." };

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const session = await requireSectionAccess("settings");
  const [params, access] = await Promise.all([searchParams, getStaffAccess(session.userId)]);
  const canManageStaff = access.isAdmin;
  const canEditCompany = access.sections.includes("company-profile");
  const [company, staffUsers] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 }, include: { profile: true, documents: true } }),
    canManageStaff ? prisma.user.findMany({ where: { roles: { some: { role: { name: "Prototype staff" } } } }, orderBy: [{ status: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, status: true, createdAt: true, sectionAccess: true } }) : Promise.resolve([]),
  ]);
  const profileKey = Array.isArray(params.profile) ? params.profile[0] : params.profile;
  const whatsappKey = Array.isArray(params.whatsapp) ? params.whatsapp[0] : params.whatsapp;
  const staffKey = Array.isArray(params.staff) ? params.staff[0] : params.staff;
  return <main className="dashboard-main">
    <header className="page-title"><div><p className="eyebrow">Manage</p><h1>Prototype settings</h1><p className="dashboard-note">Update the company details used across the website and staff documents.</p></div></header>
    <section className="panel table-panel settings-panel">
      <div className="panel-heading"><div><p className="eyebrow">Company profile</p><h3>{company?.profile?.name ?? "Company profile"}</h3><p className="dashboard-note">These details appear on the public website and on quotations.</p></div></div>
      {profileKey && <p className={`staff-feedback${profileKey === "invalid" ? " is-error" : ""}`} role="status">{profileMessages[profileKey] ?? ""}</p>}
      {canEditCompany ? <form action={updateCompanyProfile} className="prototype-form company-profile-form">
        <label>Company name<input name="name" required minLength={2} maxLength={160} defaultValue={company?.profile?.name ?? ""} /></label>
        <label>Email<input name="email" type="email" defaultValue={company?.profile?.email ?? ""} /></label>
        <label className="company-profile-wide">Address<input name="address" maxLength={300} defaultValue={company?.profile?.address ?? ""} /></label>
        <label>Phone<input name="phone" type="tel" maxLength={40} defaultValue={company?.profile?.phone ?? ""} /></label>
        <label>Quotation prefix<input name="quotePrefix" required maxLength={10} defaultValue={company?.documents?.quotePrefix ?? "QUO"} /></label>
        <label>Default tax rate (%)<input name="defaultTaxRate" type="number" min="0" max="100" step="0.01" required defaultValue={company?.documents?.defaultTaxRate ?? 0} /></label>
        <label>Quotation validity (days)<input name="quoteValidityDays" type="number" min="1" max="365" required defaultValue={company?.documents?.quoteValidityDays ?? 30} /></label>
        <button className="dashboard-button" type="submit">Save company profile</button>
      </form> : <dl className="settings-list"><div><dt>Address</dt><dd>{company?.profile?.address ?? "Not configured"}</dd></div><div><dt>Email</dt><dd>{company?.profile?.email ?? "Not configured"}</dd></div><div><dt>Phone</dt><dd>{company?.profile?.phone ?? "Not configured"}</dd></div><div><dt>Quotation prefix</dt><dd>{company?.documents?.quotePrefix ?? "Not configured"}</dd></div><div><dt>Default tax rate</dt><dd>{company?.documents?.defaultTaxRate ?? 0}%</dd></div><div><dt>Quotation validity</dt><dd>{company?.documents?.quoteValidityDays ?? "Not configured"} days</dd></div></dl>}
    </section>
    {canManageStaff && <section className="panel table-panel">
      <div className="panel-heading"><div><p className="eyebrow">Website</p><h3>WhatsApp button</h3><p className="dashboard-note">The floating WhatsApp button appears on the website and staff portal. It defaults to the published company contact number; enter another number to override it.</p></div><span className="prototype-badge">Administrator</span></div>
      {whatsappKey && <p className={`staff-feedback${whatsappKey === "invalid" ? " is-error" : ""}`} role="status">{whatsappMessages[whatsappKey] ?? ""}</p>}
      <form action={updateWhatsappSettings} className="prototype-form whatsapp-settings-form"><label>WhatsApp number<input name="number" type="tel" inputMode="tel" maxLength={40} defaultValue={company?.profile?.whatsappNumber ? `+${company.profile.whatsappNumber}` : `+${defaultWhatsappNumber}`} placeholder="+254 707 734 670" /><span>Numbers starting with 0 are treated as Kenyan (+254). Leave the published default in place to use +254 707 734 670.</span></label><label className="whatsapp-message-field">Preset message<textarea name="message" maxLength={500} defaultValue={company?.profile?.whatsappMessage ?? defaultWhatsappMessage} /></label><button className="dashboard-button" type="submit">Save WhatsApp settings</button></form>
    </section>}
    {canManageStaff && <section className="panel table-panel staff-management">
      <div className="panel-heading"><div><p className="eyebrow">Access</p><h3>Staff accounts</h3><p className="dashboard-note">Create individual sign-ins and choose which parts of the portal each person can use.</p></div><span className="prototype-badge">Administrator</span></div>
      {staffKey && <p className={`staff-feedback${["invalid", "exists"].includes(staffKey) ? " is-error" : ""}`} role="status">{staffMessages[staffKey] ?? ""}</p>}
      <form action={createStaffAccount} className="prototype-form staff-create-form"><label>Staff name<input name="name" autoComplete="name" minLength={2} maxLength={120} required /></label><label>Work email<input name="email" type="email" autoComplete="email" required /></label><label>Temporary password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><span>At least 12 characters. Share it securely.</span></label><SectionCheckboxes /><button className="dashboard-button" type="submit">Create staff account</button></form>
      <div className="table-scroll staff-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Sections</th><th>Status</th><th>Created</th><th>Access</th><th>Password</th></tr></thead><tbody>{staffUsers.length === 0 ? <tr><td colSpan={7}>No staff accounts have been created.</td></tr> : staffUsers.map((staff) => <tr key={staff.id}><td>{staff.name}</td><td>{staff.email}</td><td><details className="staff-sections-edit"><summary>{sectionSummary(staff.sectionAccess)}</summary><form action={updateStaffSections}><input type="hidden" name="userId" value={staff.id} /><SectionCheckboxes selected={staff.sectionAccess.filter((key): key is StaffAccessKey => (staffAccessKeys as readonly string[]).includes(key))} /><button className="staff-action" type="submit">Save sections</button></form></details></td><td><span className={`account-status ${staff.status === "ACTIVE" ? "is-active" : "is-disabled"}`}>{staff.status === "ACTIVE" ? "Active" : "Disabled"}</span></td><td>{staff.createdAt.toLocaleDateString("en")}</td><td><form action={setStaffStatus}><input type="hidden" name="userId" value={staff.id} /><input type="hidden" name="status" value={staff.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} /><button className="staff-action" type="submit">{staff.status === "ACTIVE" ? "Disable" : "Enable"}</button></form></td><td><details className="reset-password"><summary>Reset</summary><form action={resetStaffPassword}><input type="hidden" name="userId" value={staff.id} /><label className="sr-only" htmlFor={`password-${staff.id}`}>New password for {staff.name}</label><input id={`password-${staff.id}`} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} placeholder="12+ characters" required /><button className="staff-action" type="submit">Set password</button></form></details></td></tr>)}</tbody></table></div>
      <p className="dashboard-note staff-security-note">Disabled accounts lose access immediately. Administrator accounts are managed separately.</p>
    </section>}
  </main>;
}
