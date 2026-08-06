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
    <div className="flex items-center gap-1 border-b border-border/50">
      {CODEX_VIEWS.map((view) => {
        const Icon = view.icon;
        const active = view.id === current;
        return (
          <Link
            key={view.id}
            href={`/systems/${systemId}/codex?view=${view.id}`}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors hover:text-foreground",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {view.label}
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-primary" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
