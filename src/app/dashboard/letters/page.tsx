import { prisma } from "@/lib/prisma";
import { requireSectionAccess } from "@/lib/prototype-auth";
import LetterWriter from "./letter-writer";

export default async function LettersPage() {
  const session = await requireSectionAccess("letters");
  const company = await prisma.companyProfile.findUnique({
    where: { companyId: 1 },
    select: { name: true, address: true, email: true, phone: true, taxInformation: true },
  });

  return <main className="dashboard-main">
    <header className="page-title">
      <div><p className="eyebrow">Company documents</p><h1>Letter template</h1><p className="dashboard-note">Write directly beneath the company letterhead, then download your letter in the format you need.</p></div>
      <span className="prototype-badge">Blank letterhead</span>
    </header>
    <LetterWriter draftKey={`veteran-letter-draft-${session.userId}`} company={{
      name: company?.name ?? "Veteran Power Solutions Limited",
      address: company?.address ?? "",
      email: company?.email ?? "",
      phone: company?.phone ?? "",
      taxInformation: company?.taxInformation ?? "",
    }} />
  </main>;
}
