import { cn } from "@/lib/utils";
import { SEVERITY_LABEL } from "./review-labels";
import type { ReviewSeverity } from "./reviews.types";

const BARRAS: Record<ReviewSeverity, number> = { critical: 3, important: 2, suggestion: 1 };

/**
 * La importancia de un comentario: tres barras como las de una señal, llenas
 * según cuánto pesa, y la palabra al lado. Va en tinta y no en color porque el
 * color ya dice el tipo, y porque el rojo de la casa es de lo irreversible: un
 * comentario crítico se arregla, no se pierde.
 */
export function SeverityMark({ severity, className }: { severity: ReviewSeverity; className?: string }) {
  const llenas = BARRAS[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        severity === "critical" && "font-bold text-foreground",
        severity === "important" && "font-semibold text-foreground",
        severity === "suggestion" && "text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex h-3 items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-[3px] rounded-full", i <= llenas ? "bg-current" : "bg-current opacity-20")}
            style={{ height: `${0.25 + i * 0.25}rem` }}
          />
        ))}
      </span>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
