import { cn } from "@/lib/utils";
import { PRIORITY_WORD } from "../../task-vocab";

/**
 * Las etiquetas del ticket del tablero, sobre los roles. La prioridad es peso,
 * no color: crítica en negrita y en tinta, alta en seminegrita, media y baja
 * en mute. El coral queda para vencida y el --ok para hecha, así que ninguna
 * prioridad los usa. Sin hex sueltos: el mismo rol vale en claro y en oscuro.
 */
const PRIORITY_TAG: Record<string, { className: string; label: string }> = {
  critical: { className: "font-bold text-foreground", label: PRIORITY_WORD.critical },
  high: { className: "font-semibold text-body", label: PRIORITY_WORD.high },
  medium: { className: "text-muted-foreground", label: PRIORITY_WORD.medium },
  low: { className: "text-muted-foreground", label: PRIORITY_WORD.low },
};

const TAG = "inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium";

/**
 * La prioridad que cuenta. Cuando la fecha la subió por encima de la elegida,
 * lo dice con una flecha y un título: «Crítica» sola haría creer que se eligió
 * así, y la elección sigue siendo la otra.
 */
export function PriorityTag({ priority, chosen }: { priority: string | null; chosen?: string | null }) {
  const tag = PRIORITY_TAG[priority ?? "medium"] ?? PRIORITY_TAG.medium;
  const raised = chosen != null && chosen !== priority;
  const elegida = raised ? (PRIORITY_TAG[chosen] ?? PRIORITY_TAG.medium).label.toLowerCase() : null;
  return (
    <span
      className={cn(TAG, tag.className)}
      title={raised ? `Subió por la fecha. La elegiste ${elegida}.` : undefined}
    >
      {raised ? (
        <span aria-hidden>↑</span>
      ) : (
        <span className="size-[5px] rounded-full bg-current" />
      )}
      {tag.label}
      {raised && <span className="sr-only">, subió por la fecha; la elegiste {elegida}</span>}
    </span>
  );
}
