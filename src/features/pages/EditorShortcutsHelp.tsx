"use client";

/**
 * Reference of the Markdown shortcuts the editor understands (KIN-69). The input
 * rules themselves ship enabled with StarterKit; this just makes them
 * discoverable from the notebook side panel.
 */

const SHORTCUTS: { keys: string; label: string }[] = [
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

export function EditorShortcutsHelp() {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Atajos de formato
      </p>
      <ul className="space-y-1.5">
        {SHORTCUTS.map(({ keys, label }) => (
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
