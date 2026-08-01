"use client";

import type { MediumManifest } from "@/shared/lib/mediums";

/**
 * Reference of the Markdown shortcuts the editor understands (KIN-69). The input
 * rules themselves ship enabled with StarterKit; this just makes them
 * discoverable from the notebook side panel.
 *
 * En una obra de escritura se suman los atajos del medium (W3): el corte de
 * escena de la novela, el encadenado de paneles del manga, el Tab del guion.
 */

type Shortcut = { keys: string; label: string };

const SHORTCUTS: Shortcut[] = [
  { keys: "# ## ###", label: "Títulos 1–3" },
  { keys: "- *", label: "Lista" },
  { keys: "1.", label: "Lista numerada" },
  { keys: ">", label: "Cita" },
  { keys: "```", label: "Bloque de código" },
  { keys: "---", label: "Separador" },
  { keys: "**·**", label: "Negrita" },
  { keys: "*·*", label: "Cursiva" },
  { keys: "/", label: "Insertar bloque (tabla, tareas…)" },
];

const SCENE_BREAK_SHORTCUT: Shortcut = { keys: "* * *", label: "Separador de escena" };
const PANEL_SHORTCUT: Shortcut = { keys: "Enter", label: "Siguiente panel (al final del panel)" };
const SCREENPLAY_SHORTCUTS: Shortcut[] = [
  { keys: "Tab", label: "Ciclar tipo de línea del guion" },
  { keys: "⇧ Tab", label: "Ciclar hacia atrás" },
  { keys: "INT.", label: "Encabezado de escena" },
];

function mediumShortcuts(medium: MediumManifest | null): Shortcut[] {
  if (!medium) return [];
  const extra: Shortcut[] = [];
  if (medium.blocks.includes("sceneBreak")) extra.push(SCENE_BREAK_SHORTCUT);
  if (medium.blocks.includes("panel")) extra.push(PANEL_SHORTCUT);
  if (medium.screenplayKeys) extra.push(...SCREENPLAY_SHORTCUTS);
  return extra;
}

export function EditorShortcutsHelp({ medium = null }: { medium?: MediumManifest | null }) {
  const shortcuts = [...mediumShortcuts(medium), ...SHORTCUTS];

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Atajos de formato
      </p>
      <ul className="space-y-1.5">
        {shortcuts.map(({ keys, label }) => (
          <li key={keys} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground truncate">{label}</span>
            <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
              {keys}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}
