import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://j-addid.com";

const title = "جَدِّد | JADDID — إدارة اشتراكات عملائك";
const description =
  "منصة جَدِّد لإدارة اشتراكات وعملاء متجرك — استورد منتجاتك، تابع الاشتراكات، وذكّر عملاءك بالتجديد من مكان واحد.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: "%s | جَدِّد",
  },
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ar_SA",
    url: SITE_URL,
    siteName: "جَدِّد | JADDID",
    title,
    description,
    images: [
      {
        url: "/brand/jaddid-og.png",
        width: 1254,
        height: 1254,
        alt: "جَدِّد | JADDID",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/brand/jaddid-og.png"],
  },
  icons: {
    icon: "/brand/jaddid-icon-128.png",
    apple: "/brand/jaddid-icon-128.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] font-sans">
        {children}
        {/* Vercel Web Analytics.
            Served from /_vercel/insights on this same origin, so it needs
            no CSP exception — and it sets no cookie and collects no
            personal data, which matters for a product whose visitors are
            merchants looking at their own customers' details. */}
        <Analytics />
      </body>
    </html>
  );
}
