import { marketingFontVars } from "@/features/marketing/fonts";
import { MarketingFooter } from "@/features/marketing/MarketingFooter";

/**
 * Shell del sitio público (landing + docs). Tema dark propio y fuentes
 * exclusivas de marketing: no carga ninguno de los providers de la app.
 * Cada página monta su propia <MarketingNav variant=.../>; el footer es común.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${marketingFontVars} font-body min-h-screen bg-[#0e0e11] text-base leading-relaxed text-[#a1a1aa]`}
    >
      {children}
      <MarketingFooter />
    </div>
  );
}
