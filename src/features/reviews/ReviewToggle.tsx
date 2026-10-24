"use client";

import { MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useReviewUi } from "./ReviewContext";
import { usePageReview } from "./reviews.hooks";

/**
 * El botón de la revisión en la barra del cuaderno. Dice cuánto queda abierto,
 * y un punto cuando el agente contestó algo y te toca a ti: es la única
 * llamada que la revisión hace desde fuera del panel.
 */
export function ReviewToggle({ pageId }: { pageId: string }) {
  const ui = useReviewUi();
  const { data } = usePageReview(pageId);
  if (!ui) return null;
  const abiertos = data?.comments.filter((c) => c.status === "open") ?? [];
  const teToca = abiertos.some((c) => c.awaiting === "person");

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("relative h-8 shrink-0 gap-1.5 px-2.5 text-muted-foreground", ui.open && "bg-muted text-foreground")}
      aria-pressed={ui.open}
      aria-label={abiertos.length > 0 ? `Revisión, ${abiertos.length} por cerrar` : "Revisión"}
      onClick={() => ui.setOpen(!ui.open)}
    >
      <MessageSquareText className="size-4" aria-hidden />
      {abiertos.length > 0 && <span className="text-xs font-semibold tabular-nums">{abiertos.length}</span>}
      {teToca && <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" aria-hidden />}
    </Button>
  );
}
