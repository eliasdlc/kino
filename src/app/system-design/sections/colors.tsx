"use client";

import { Section, SubSection, TokenSwatch } from "../helpers";
import { COLOR_VALUES } from "@/shared/types/enums";
import { getSystemColor, getSystemColorCss } from "@/shared/utils/system-colors";
import {
  STICKY_NOTE_COLORS,
  paperStyle,
} from "@/features/sticky-notes/sticky-note-colors";

/**
 * Los roles: un valor por modo, sin nombre de color. Los hex y los contrastes
 * (WCAG, luminancia relativa, sobre --bg) son los de globals.css.
 */
const ROLE_TOKENS: Array<{ token: string; usage: string }> = [
  { token: "bg", usage: "Fondo: papel. #f8f5ef, #171512" },
  { token: "sf", usage: "Superficie: hoja, diálogo, menú. #fffdf9, #221f1a" },
  { token: "sf2", usage: "Superficie sobre superficie: segmento, pastilla secundaria. #efeae0, #2f2b24" },
  { token: "ink", usage: "Títulos y valores. #211d16, #f5f1ea. Contraste 15,4 / 16,2" },
  { token: "body", usage: "Texto corrido. #4a443a, #d9d3c8. Contraste 8,9 / 12,2" },
  { token: "mute", usage: "Meta, numeral de índice, inactivo. #6f685c, #a39c8f. Contraste 5,1 / 6,7" },
  { token: "ac", usage: "Acento: acción y selección, nada más. #8a5a00, #e8b04b. Contraste 5,5 / 9,3" },
  { token: "on", usage: "Texto e icono sobre el acento. #ffffff, #1a1204. Sobre ac 5,9 / 9,5" },
  { token: "warn", usage: "Vencida, dormido: acompaña a la palabra. #a83f22, #e8836a. Contraste 5,7 / 6,8" },
  { token: "ok", usage: "Hecha: el círculo relleno. #1e7a45, #5fcb8a. Contraste 4,9 / 9,0" },
  { token: "danger", usage: "Sólo borrar y cerrar: lo irreversible. #b3123a, #ff5c7a. Contraste 6,3 / 6,1" },
  { token: "ln", usage: "Hairline: tinta al 8 %" },
  { token: "ln2", usage: "Hairline fuerte: tinta al 16 %, el borde de un campo o del círculo" },
  { token: "scrim", usage: "El fondo detrás de un overlay: tinta al 20 % en claro, bg al 60 % en oscuro" },
];

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
    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
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
      description="Todo color de Kino sale de un rol (globals.css). El acento es el ámbar (hue 38) y la escala neutra entera va teñida con ese hue a saturación 12: papel, no gris. Los roles también son clases: bg-sf2, text-mute, border-ln2. Los componentes nunca usan colores directos salvo las tres paletas físicas de abajo."
    >
      <SubSection
        title="Roles"
        description="El contrato de la identidad. Los tokens de shadcn de abajo no declaran ningún color: cada uno vale var(--rol). Los contrastes valen para texto de rol sobre bg; como borde, ln2 y sf2 no llegan a 3:1, así que el texto identifica el control. El badge usa el texto de tinte (--ac-text, --ok-text, --warn-text, --danger-text): el rol mezclado con tinta al 28 % en claro, para dar 4,5 o más sobre su tinte también en hover."
      >
        <TokenGrid tokens={ROLE_TOKENS} />
      </SubSection>

      <SubSection title="Roles en oscuro" description="Los mismos roles forzados a .dark. La elevación es un paso de tono: bg, sf, sf2, y ninguna sombra.">
        <DarkPreview tokens={ROLE_TOKENS} />
      </SubSection>

      <SubSection
        title="Tokens semánticos, tema actual"
        description="Cambia el tema con el control de arriba para comparar. Cada swatch lee la variable CSS en vivo: lo que ves es exactamente lo que renderiza la app."
      >
        <TokenGrid tokens={SEMANTIC_TOKENS} />
      </SubSection>

      <SubSection
        title="Tokens semánticos, vista fija en oscuro"
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
        description="Paleta fija de 11 valores (shared/utils/system-colors.ts). Ocho son la paleta física de Tailwind y los tres neutros (gray, black, white) son roles de la casa: mute, ink y sf2. Se componen como text-{c}, bg-{c} y bg-{c}/10 (safelist en globals.css) o como valor CSS para estilos inline."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_VALUES.map((color) => {
            const hex = getSystemColorCss(color);
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
                    {getSystemColor(color)}, {hex}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border p-4">
          <span className="text-xs text-muted-foreground">Composiciones:</span>
          <span className="text-blue-500 text-sm font-medium">text-blue-500</span>
          <span className="rounded-full bg-blue-500 px-2 py-1 text-sm font-medium text-on">
            bg-blue-500
          </span>
          <span className="rounded-full bg-blue-500/10 px-2 py-1 text-sm font-medium text-blue-500">
            bg-blue-500/10
          </span>
        </div>
      </SubSection>

      <SubSection
        title="Notas adhesivas: la paleta de papel"
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
