import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "الأسعار",
  description: "باقات جَدِّد لإدارة اشتراكات وعملاء متجرك.",
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-10">
        <Pricing standalone />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
