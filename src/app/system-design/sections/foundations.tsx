"use client";

import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";

const RADII: Array<{ name: string; cls: string; note: string }> = [
  { name: "radius-sm", cls: "rounded-sm", note: "0.6 × base" },
  { name: "radius-md", cls: "rounded-md", note: "0.8 × base — botones, inputs" },
  { name: "radius-lg", cls: "rounded-lg", note: "base (0.625rem) — cards" },
  { name: "radius-xl", cls: "rounded-xl", note: "1.4 × base — paneles" },
  { name: "radius-2xl", cls: "rounded-2xl", note: "1.8 × base" },
  { name: "radius-3xl", cls: "rounded-3xl", note: "2.2 × base" },
  { name: "radius-4xl", cls: "rounded-4xl", note: "2.6 × base — badges (pill)" },
];

export function FoundationsSection() {
  return (
    <Section
      id="fundamentos"
      number="03"
      title="Radios, sombras y espaciado"
      description="Los radios derivan todos de --radius (0.625rem). Las sombras estándar son las de Tailwind; las cards físicas (sistemas/folders) usan sombras propias más profundas."
    >
      <SubSection title="Radios">
        <div className="flex flex-wrap items-end gap-4">
          {RADII.map((r) => (
            <div key={r.name} className="flex flex-col items-center gap-2">
              <div className={`size-20 border border-border bg-muted ${r.cls}`} />
              <p className="font-mono text-[11px] text-muted-foreground">{r.name}</p>
              <p className="max-w-24 text-center text-[10px] text-muted-foreground">{r.note}</p>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            <div className="size-20 rounded-[20px] border border-border bg-muted sm:rounded-[28px]" />
            <p className="font-mono text-[11px] text-muted-foreground">20/28px</p>
            <p className="max-w-24 text-center text-[10px] text-muted-foreground">
              PhysicalCard (fijo, no token)
            </p>
          </div>
        </div>
      </SubSection>

      <SubSection title="Sombras">
        <SpecimenGrid cols={4}>
          <Specimen label="shadow-xs" hint="Button outline, swatches">
            <div className="size-20 rounded-lg bg-card shadow-xs" />
          </Specimen>
          <Specimen label="shadow-sm" hint="Elementos elevados ligeros">
            <div className="size-20 rounded-lg bg-card shadow-sm" />
          </Specimen>
          <Specimen label="PhysicalCard móvil" hint="0 8px 20px rgba(0,0,0,.10)">
            <div className="size-20 rounded-[20px] bg-card shadow-[0_8px_20px_rgba(0,0,0,0.10)]" />
          </Specimen>
          <Specimen label="PhysicalCard desktop" hint="0 14px 30px rgba(0,0,0,.14)">
            <div className="size-20 rounded-[28px] bg-card shadow-[0_14px_30px_rgba(0,0,0,0.14)]" />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Espaciado"
        description="Escala Tailwind (múltiplos de 4px). Los ritmos habituales en Kino: gap-1.5/gap-2 dentro de un control, gap-3/gap-4 entre elementos, p-4/p-6 en superficies, space-y-12 entre bloques de página."
      >
        <div className="flex flex-wrap items-end gap-6">
          {[
            ["1", "4px"],
            ["1.5", "6px"],
            ["2", "8px"],
            ["3", "12px"],
            ["4", "16px"],
            ["6", "24px"],
            ["8", "32px"],
            ["12", "48px"],
          ].map(([step, px]) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <div
                className="w-4 rounded-sm bg-primary/70"
                style={{ height: `calc(${px})` }}
              />
              <p className="font-mono text-[11px] text-muted-foreground">
                {step} · {px}
              </p>
            </div>
          ))}
        </div>
      </SubSection>
    </Section>
  );
}
