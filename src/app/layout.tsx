import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "About Veteran Power Solutions Limited | We light your world",
  description: "Learn about Veteran Power Solutions Limited and our locally available Power, Solar, and Borehole products and services.",
  icons: { icon: "/veteran-brand-icon.png" },
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
