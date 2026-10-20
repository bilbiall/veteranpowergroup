import Image from "next/image";

export function CompanyBrand({ className = "" }: { className?: string }) {
  return <Image className={`company-logo ${className}`} src="/veteran-power-solutions-logo.jpeg" alt="Veteran Power Solutions Limited — We light your world" width={1450} height={520} priority />;
}
