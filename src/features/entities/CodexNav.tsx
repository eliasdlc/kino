import Link from "next/link";
import { cn } from "@/lib/utils";
import { CODEX_VIEWS, type CodexViewId } from "./codex.views";

/**
 * Navegación entre las lecturas del codex. Server component a propósito: son
 * enlaces con `?view=`, así el estado vive en la URL (convención del proyecto
 * para filtros de vista) y cada lectura se carga sola.
 */
export function CodexNav({
  systemId,
  current,
}: {
  systemId: string;
  current: CodexViewId;
}) {
  return (
    // En el teléfono las cuatro lecturas no caben: la fila hace scroll horizontal y ninguna etiqueta se parte.
    // Son pestañas-palabra, como las de la cabecera del sistema: la elegida en
    // tinta con su subrayado. Elegir una lectura es un estado, y el ámbar se
    // queda para crear (Nueva entidad).
    <div
      className="-mx-1 flex items-end gap-x-5 overflow-x-auto border-b border-border px-1 [scrollbar-width:none]"
      role="tablist"
      aria-label="Lecturas del codex"
    >
      {CODEX_VIEWS.map((view) => {
        const Icon = view.icon;
        const active = view.id === current;
        return (
          <Link
            key={view.id}
            href={`/systems/${systemId}/codex?view=${view.id}`}
            role="tab"
            aria-selected={active}
            className={cn(
              "relative flex h-[2.85rem] shrink-0 items-center gap-1.5 px-1 text-sm font-semibold whitespace-nowrap transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {view.label}
            {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" />}
          </Link>
        );
      })}
    </div>
  );
}
