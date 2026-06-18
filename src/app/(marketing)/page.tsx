import type { Metadata } from "next";
import { MarketingNav } from "@/features/marketing/MarketingNav";
import { LandingHero } from "@/features/marketing/landing/LandingHero";
import { LandingEnergyDemo } from "@/features/marketing/landing/LandingEnergyDemo";
import { LandingHowItWorks } from "@/features/marketing/landing/LandingHowItWorks";
import { LandingIntelligence } from "@/features/marketing/landing/LandingIntelligence";
import { LandingSystems } from "@/features/marketing/landing/LandingSystems";
import { LandingDocsTeaser } from "@/features/marketing/landing/LandingDocsTeaser";
import { LandingFinalCta } from "@/features/marketing/landing/LandingFinalCta";

export const metadata: Metadata = {
  title: "Kino — Trabaja con tu energía, no contra ella",
  description:
    "Kino aprende tu curva de energía y arma un plan diario corto y accionable: qué hacer, cuándo hacerlo y cuándo descansar.",
};

export default function LandingPage() {
  return (
    <>
      <MarketingNav variant="landing" />
      <LandingHero />
      <LandingEnergyDemo />
      <LandingHowItWorks />
      <LandingIntelligence />
      <LandingSystems />
      <LandingDocsTeaser />
      <LandingFinalCta />
    </>
  );
}
