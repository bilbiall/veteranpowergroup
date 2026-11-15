import Image from "next/image";

export function CompanyBrand({ className = "" }: { className?: string }) {
  return <Image className={`company-logo ${className}`} src="/veteran-document-logo.png" alt="Veteran Power Solutions Limited — We light your world" width={900} height={320} priority />;
}
