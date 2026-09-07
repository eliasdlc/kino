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
      className={`min-h-screen bg-background text-base leading-relaxed text-muted-foreground`}
    >
      {children}
      <MarketingFooter />
    </div>
  );
}
