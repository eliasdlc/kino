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
    <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]" role="tablist">
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
              "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors",
              active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
