import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import {
  ImportSection,
  CustomersSection,
  SubscriptionsSection,
  TemplatesSection,
  RenewalOpportunitiesSection,
} from "@/components/landing/FeatureSections";
import DashboardPreview from "@/components/landing/DashboardPreview";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <ImportSection />
        <CustomersSection />
        <SubscriptionsSection />
        <TemplatesSection />
        <RenewalOpportunitiesSection />
        <DashboardPreview />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
