import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { siteKeywords, siteName, siteUrl } from "@/lib/seo";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Solar, Borehole & Electrical Solutions in Nairobi, Kenya | Veteran Power Solutions",
    template: "%s | Veteran Power Solutions",
  },
  description: "Veteran Power Solutions provides solar, borehole, electrical, battery and inverter solutions in Nairobi and across Kenya, including water pumps, wiring and backup power.",
  applicationName: siteName,
  keywords: siteKeywords,
  alternates: { canonical: "/" },
  icons: { icon: "/veteran-brand-icon.png" },
  openGraph: {
    type: "website",
    siteName,
    locale: "en_KE",
    url: "/",
    title: "Solar, Borehole & Electrical Solutions in Kenya | Veteran Power Solutions",
    description: "Solar, batteries, inverters, water pumps, boreholes, electrical wiring and off-grid systems, supplied and installed across Kenya.",
    images: [{ url: "/veteran-renewable-hero.png", alt: "Veteran Power Solutions solar and power installations" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Solar, Borehole & Electrical Solutions in Kenya | Veteran Power Solutions",
    description: "Solar, batteries, inverters, water pumps, boreholes, electrical wiring and off-grid systems across Kenya.",
    images: ["/veteran-renewable-hero.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spaceGrotesk.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const saved=localStorage.getItem("veteran-color-scheme");const systemDark=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=saved||(systemDark?"dark":"light")}catch{}` }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
