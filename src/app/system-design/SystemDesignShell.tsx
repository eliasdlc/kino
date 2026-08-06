"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SystemTypeProvider } from "@/components/SystemTypeProvider";
import { FocusTimerProvider } from "@/features/tasks/FocusTimerProvider";
import { ColorsSection } from "./sections/colors";
import { TypographySection } from "./sections/typography";
import { FoundationsSection } from "./sections/foundations";
import { IconsSection } from "./sections/icons";
import { ButtonsSection } from "./sections/buttons";
import { FormsSection } from "./sections/forms";
import { OverlaysSection } from "./sections/overlays";
import { ContentSection } from "./sections/content";
import { KinoSection } from "./sections/kino";
import { DashboardSection } from "./sections/dashboard";
import { EnergyBudgetSection } from "./sections/energy-budget";
import { TasksViewsSection } from "./sections/tasks-views";
import { NotebooksSection } from "./sections/notebooks";
import { MobileSection } from "./sections/mobile";
import { CodexSection } from "./sections/codex";
import { MediumsSection } from "./sections/mediums";
import { MotivationSection } from "./sections/motivation";
import { OnboardingSection } from "./sections/onboarding";

const TOC: Array<{ id: string; number: string; label: string }> = [
  { id: "colores", number: "01", label: "Colores" },
  { id: "tipografia", number: "02", label: "Tipografía" },
  { id: "fundamentos", number: "03", label: "Radios y sombras" },
  { id: "iconos", number: "04", label: "Iconografía" },
  { id: "botones", number: "05", label: "Botones y badges" },
  { id: "formularios", number: "06", label: "Formularios" },
  { id: "overlays", number: "07", label: "Overlays" },
  { id: "contenido", number: "08", label: "Contenido y datos" },
  { id: "kino", number: "09", label: "Componentes Kino" },
  { id: "dashboard", number: "10", label: "Dashboard" },
  { id: "energia", number: "11", label: "Energía visible" },
  { id: "tareas", number: "12", label: "Tareas: vistas" },
  { id: "notebooks", number: "13", label: "Notebooks y notas" },
  { id: "mobile", number: "14", label: "Mobile" },
  { id: "codex", number: "15", label: "Codex" },
  { id: "mediums", number: "16", label: "Bloques por medium" },
  { id: "motivacion", number: "17", label: "Motivación" },
  { id: "onboarding", number: "18", label: "Onboarding por identidad" },
];

/**
 * Catálogo visual de Kino (/system-design). Página autónoma (fuera del layout
 * autenticado): renderiza los componentes reales de producción con datos de
 * muestra, así que todo cambio de UI se previsualiza aquí antes de tocar vistas.
 */
export function SystemDesignShell() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Sin backend en esta página: las queries internas (folders, subtasks)
        // fallan en silencio y las cards renderizan sin ese metadato.
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      })
  );

  // Toggle local de tema: manipula la clase .dark del <html> igual que el
  // ThemeProvider de la app, pero sin persistir — es una herramienta de
  // comparación y arranca siempre en light para ser predecible.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <QueryClientProvider client={queryClient}>
      <SystemTypeProvider>
        <FocusTimerProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-background text-foreground">
              <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-semibold tracking-tight">
                      Kino · System Design
                    </h1>
                    <p className="hidden text-xs text-muted-foreground sm:block">
                      Catálogo vivo de todos los componentes, estados y tokens de la UI
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Cambiar tema"
                    onClick={() => setDark((d) => !d)}
                  >
                    {dark ? <Sun /> : <Moon />}
                  </Button>
                </div>
                <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:hidden">
                  {TOC.map((t) => (
                    <a
                      key={t.id}
                      href={`#${t.id}`}
                      className="shrink-0 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {t.label}
                    </a>
                  ))}
                </nav>
              </header>

              <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-6">
                <aside className="sticky top-16 hidden h-fit w-48 shrink-0 py-10 lg:block">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Secciones
                  </p>
                  <ul className="space-y-1">
                    {TOC.map((t) => (
                      <li key={t.id}>
                        <a
                          href={`#${t.id}`}
                          className="flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <span className="font-mono text-[10px]">{t.number}</span>
                          {t.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </aside>

                <main className="min-w-0 flex-1 pb-24 pt-4">
                  <ColorsSection />
                  <TypographySection />
                  <FoundationsSection />
                  <IconsSection />
                  <ButtonsSection />
                  <FormsSection />
                  <OverlaysSection />
                  <ContentSection />
                  <KinoSection />
                  <DashboardSection />
                  <EnergyBudgetSection />
                  <TasksViewsSection />
                  <NotebooksSection />
                  <MobileSection />
                  <CodexSection />
                  <MediumsSection />
                  <MotivationSection />
                  <OnboardingSection />
                </main>
              </div>
            </div>
          </TooltipProvider>
        </FocusTimerProvider>
      </SystemTypeProvider>
    </QueryClientProvider>
  );
}
