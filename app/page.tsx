import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Marquee from "@/components/landing/Marquee";
import ProductStory from "@/components/landing/ProductStory";
import HowItWorks from "@/components/landing/HowItWorks";
import {
  ImportSection,
  CustomersSection,
  SubscriptionsSection,
  TemplatesSection,
  RenewalOpportunitiesSection,
} from "@/components/landing/FeatureSections";
import WhyJaddid from "@/components/landing/WhyJaddid";
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
        <div className="py-10">
          <Marquee />
        </div>
        <ProductStory />
        <HowItWorks />
        <div id="features">
          <ImportSection />
          <CustomersSection />
          <SubscriptionsSection />
          <TemplatesSection />
          <RenewalOpportunitiesSection />
        </div>
        <WhyJaddid />
        <DashboardPreview />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
