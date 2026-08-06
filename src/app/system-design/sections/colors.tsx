"use client";

import { Section, SubSection, TokenSwatch } from "../helpers";
import { COLOR_VALUES } from "@/shared/types/enums";
import { getSystemColor, getSystemColorHex } from "@/shared/utils/system-colors";
import {
  STICKY_NOTE_COLORS,
  paperStyle,
} from "@/features/sticky-notes/sticky-note-colors";

const SEMANTIC_TOKENS: Array<{ token: string; usage: string }> = [
  { token: "background", usage: "Fondo base de la app" },
  { token: "foreground", usage: "Texto principal" },
  { token: "card", usage: "Superficies elevadas (Card, popovers de lista)" },
  { token: "card-foreground", usage: "Texto sobre card" },
  { token: "popover", usage: "Dropdowns, tooltips, command palette" },
  { token: "popover-foreground", usage: "Texto sobre popover" },
  { token: "primary", usage: "Acción principal (Button default)" },
  { token: "primary-foreground", usage: "Texto sobre primary" },
  { token: "secondary", usage: "Acción secundaria (Button secondary)" },
  { token: "secondary-foreground", usage: "Texto sobre secondary" },
  { token: "muted", usage: "Fondos atenuados, hover de ghost" },
  { token: "muted-foreground", usage: "Texto secundario / metadatos" },
  { token: "accent", usage: "Hover de items de menú" },
  { token: "accent-foreground", usage: "Texto sobre accent" },
  { token: "destructive", usage: "Acciones destructivas, errores" },
  { token: "border", usage: "Bordes de tarjetas y separadores" },
  { token: "input", usage: "Borde de inputs" },
  { token: "ring", usage: "Focus ring (focus-visible)" },
];

const CHART_TOKENS: Array<{ token: string; usage: string }> = [
  { token: "chart-1", usage: "Serie 1" },
  { token: "chart-2", usage: "Serie 2" },
  { token: "chart-3", usage: "Serie 3" },
  { token: "chart-4", usage: "Serie 4" },
  { token: "chart-5", usage: "Serie 5" },
];

const SIDEBAR_TOKENS: Array<{ token: string; usage: string }> = [
  { token: "sidebar", usage: "Fondo del sidebar" },
  { token: "sidebar-foreground", usage: "Texto del sidebar" },
  { token: "sidebar-primary", usage: "Acento principal (item activo)" },
  { token: "sidebar-primary-foreground", usage: "Texto sobre el acento" },
  { token: "sidebar-accent", usage: "Hover de items" },
  { token: "sidebar-accent-foreground", usage: "Texto sobre hover" },
  { token: "sidebar-border", usage: "Borde del sidebar" },
  { token: "sidebar-ring", usage: "Focus ring dentro del sidebar" },
];

function TokenGrid({ tokens }: { tokens: Array<{ token: string; usage: string }> }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {tokens.map((t) => (
        <TokenSwatch key={t.token} token={t.token} usage={t.usage} />
      ))}
    </div>
  );
}

/** Panel que fuerza el tema oscuro en su subárbol (la clase .dark redefine los tokens). */
function DarkPreview({ tokens }: { tokens: Array<{ token: string; usage: string }> }) {
  return (
    <div className="dark rounded-xl border border-border bg-background p-4 text-foreground">
      <TokenGrid tokens={tokens} />
    </div>
  );
}

export function ColorsSection() {
  return (
    <Section
      id="colores"
      number="01"
      title="Colores"
      description="Todos los colores de Kino salen de tokens semánticos (globals.css, oklch). Los componentes nunca usan colores directos salvo las tres paletas físicas de abajo: colores de sistema, sticky notes y energía."
    >
      <SubSection
        title="Tokens semánticos — tema actual"
        description="Cambia el tema con el control de arriba para comparar. Cada swatch lee la variable CSS en vivo: lo que ves es exactamente lo que renderiza la app."
      >
        <TokenGrid tokens={SEMANTIC_TOKENS} />
      </SubSection>

      <SubSection
        title="Tokens semánticos — vista fija en dark"
        description="El mismo set forzado a .dark, para comparar ambos temas lado a lado sin cambiar el tema global."
      >
        <DarkPreview tokens={SEMANTIC_TOKENS} />
      </SubSection>

      <SubSection title="Charts" description="Series de gráficos (insights, energía).">
        <TokenGrid tokens={CHART_TOKENS} />
      </SubSection>

      <SubSection title="Sidebar" description="El sidebar tiene su propio juego de tokens.">
        <TokenGrid tokens={SIDEBAR_TOKENS} />
      </SubSection>

      <SubSection
        title="Colores de sistema"
        description="Paleta fija de 11 valores (shared/utils/system-colors.ts). Se componen como text-{c}, bg-{c} y bg-{c}/10 (safelist en globals.css) o como hex para gradientes inline."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_VALUES.map((color) => {
            const hex = getSystemColorHex(color);
            return (
              <div
                key={color}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
              >
                <div
                  className="size-10 shrink-0 rounded-md border border-border/60"
                  style={{ background: hex }}
                />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium">{color}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {getSystemColor(color)} · {hex}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border p-4">
          <span className="text-xs text-muted-foreground">Composiciones:</span>
          <span className="text-blue-500 text-sm font-medium">text-blue-500</span>
          <span className="rounded-md bg-blue-500 px-2 py-1 text-sm font-medium text-white">
            bg-blue-500
          </span>
          <span className="rounded-md bg-blue-500/10 px-2 py-1 text-sm font-medium text-blue-500">
            bg-blue-500/10
          </span>
        </div>
      </SubSection>

      <SubSection
        title="Sticky notes — paleta de papel"
        description="Cada color define papel (hex) + tinta (textHex) + variantes Tailwind para bordes (sticky-note-colors.ts). La sombra viene de paperStyle()."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(STICKY_NOTE_COLORS).map(([name, c]) => (
            <div
              key={name}
              className="flex aspect-square flex-col justify-between rounded-sm p-2.5"
              style={{ ...paperStyle(c.hex), color: c.textHex }}
            >
              <span className="text-xs font-medium">{name}</span>
              <span className="font-mono text-[10px] opacity-70">{c.hex}</span>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection
        title="Energía"
        description="Los tres niveles de energía usan colores fijos en toda la app: high=green, medium=yellow, low=red (composición con la paleta de sistema)."
      >
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["high", "green", "Alta"],
              ["medium", "yellow", "Media"],
              ["low", "red", "Baja"],
            ] as const
          ).map(([level, color, label]) => (
            <div
              key={level}
              className={`flex items-center gap-2 rounded-lg border border-border bg-${getSystemColor(color)}/10 px-3 py-2`}
            >
              <span className={`size-2.5 rounded-full bg-${getSystemColor(color)}`} />
              <span className="text-sm font-medium">{label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{level}</span>
            </div>
          ))}
        </div>
      </SubSection>
    </Section>
  );
}
