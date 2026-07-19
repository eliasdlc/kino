"use client";

import { Section, SubSection } from "../helpers";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { BottomNav } from "@/components/BottomNav";

export function MobileSection() {
  return (
    <Section
      id="mobile"
      number="13"
      title="Mobile"
      description="El chrome móvil de la app. Ambos componentes son md:hidden y BottomNav es fixed; aquí van dentro de un marco de teléfono con overrides de display/posición para poder verlos en desktop."
    >
      <SubSection
        title="MobileHeader + BottomNav"
        description="Header con trigger de sidebar y quick-add; nav inferior de 5 destinos con estado activo (resalta la ruta actual)."
      >
        <div className="w-[360px] overflow-hidden rounded-[24px] border border-border bg-background shadow-lg">
          <SidebarProvider className="block min-h-0 w-auto">
            <div className="[&_header]:flex!">
              <MobileHeader />
            </div>
            <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
              contenido de la vista
            </div>
            <div className="[&_nav]:static! [&_nav]:block!">
              <BottomNav />
            </div>
          </SidebarProvider>
        </div>
        <p className="mt-3 max-w-2xl text-xs text-muted-foreground">
          Reglas mobile (project-mobile): formularios en ResponsiveDialog (drawer bajo 768px),
          sin drag-and-drop en touch (selects de fallback, como el de columna en BoardCard),
          y acciones hover siempre visibles en móvil (md:opacity-0 solo en desktop).
        </p>
      </SubSection>
    </Section>
  );
}
