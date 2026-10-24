"use client";

import { useState } from "react";
import { Check, CornerDownLeft, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_ICON, CATEGORY_LABEL, QUESTION_ICON, SEVERITY_LABEL, authorLabel } from "./review-labels";
import { BODY_MAX } from "@convex/lib/reviews";
import { replySchema } from "./reviews.schemas";
import type { AnchorState, ReviewComment } from "./reviews.types";

/** Motivos de un descarte, para que la siguiente pasada sepa por qué. */
const MOTIVOS = ["No aplica aquí", "Lo quiero así", "No estoy de acuerdo"] as const;

export interface CommentCardHandlers {
  onActivate: () => void;
  onResolve: (resolution: "edited" | "applied" | "marked") => void;
  onDismiss: (reason?: string) => void;
  onReopen: () => void;
  onReply: (body: string) => void;
  /** Sustituye el fragmento por la propuesta; `false` si el fragmento ya no está. */
  onApply: (text: string) => boolean;
}

/**
 * Un comentario de revisión. Se lee de arriba abajo en el orden en que se
 * trabaja: qué fragmento, qué pasa ahí y por qué, una pista para pensarlo, y la
 * propuesta sólo si se pide. La propuesta va escondida a propósito: la que se
 * ve antes de pensar es la que se acepta sin pensar.
 */
export function CommentCard({
  comment,
  reviewer,
  anchor,
  active,
  pending = false,
  ...handlers
}: {
  comment: ReviewComment;
  reviewer: string | null;
  /** Dónde está su fragmento en el texto de ahora. Sólo lo saben los abiertos. */
  anchor: AnchorState | null;
  active: boolean;
  pending?: boolean;
} & CommentCardHandlers) {
  const [verPista, setVerPista] = useState(false);
  const [verPropuesta, setVerPropuesta] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [respondiendo, setRespondiendo] = useState(false);
  const [borrador, setBorrador] = useState("");

  const abierto = comment.status === "open";
  const CategoryIcon = comment.category ? CATEGORY_ICON[comment.category] : QUESTION_ICON;
  const etiqueta = comment.category ? CATEGORY_LABEL[comment.category] : "Pregunta";
  const firma = authorLabel(comment.author, reviewer);

  function responder() {
    const parsed = replySchema.safeParse({ body: borrador });
    if (!parsed.success) return;
    handlers.onReply(parsed.data.body);
    setBorrador("");
    setRespondiendo(false);
  }

  function aplicar() {
    if (!comment.suggestion) return;
    if (handlers.onApply(comment.suggestion)) handlers.onResolve("applied");
  }

  return (
    <article
      data-comment-id={comment.id}
      data-active={active || undefined}
      aria-current={active || undefined}
      onClick={handlers.onActivate}
      className={cn(
        "group/comment scroll-mt-4 rounded-[1.125rem] border bg-background p-3.5 text-sm transition-[border-color,background-color,opacity] duration-200",
        active ? "border-primary/60 bg-primary/[0.04]" : "border-border hover:border-[var(--ln2)]",
        !abierto && "opacity-75",
      )}
    >
      <header className="mb-2 flex items-center gap-2 text-xs">
        <CategoryIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">{etiqueta}</span>
        {comment.severity && (
          <span
            className={cn(
              "ml-auto",
              comment.severity === "critical" && "font-bold text-foreground",
              comment.severity === "important" && "font-semibold text-foreground",
              comment.severity === "suggestion" && "text-muted-foreground",
            )}
          >
            {SEVERITY_LABEL[comment.severity]}
          </span>
        )}
      </header>

      <blockquote
        className={cn(
          "mb-2 line-clamp-2 border-l-2 border-[var(--ln2)] pl-2.5 font-serif text-[0.9rem] italic text-muted-foreground",
          anchor === "missing" && "line-through decoration-[var(--mute)]",
        )}
      >
        {comment.quote}
      </blockquote>
      {abierto && anchor === "edited" && (
        <p className="mb-2 text-xs font-medium text-[var(--ok)]">Reescribiste este fragmento.</p>
      )}
      {abierto && anchor === "missing" && (
        <p className="mb-2 text-xs text-muted-foreground">Este fragmento ya no está en el texto.</p>
      )}

      <p className="whitespace-pre-line text-foreground/90">{comment.body}</p>

      {(comment.hint || comment.suggestion) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {comment.hint && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVerPista((v) => !v);
              }}
              aria-expanded={verPista}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Lightbulb className="size-3.5" aria-hidden />
              Pista
            </button>
          )}
          {comment.suggestion && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVerPropuesta((v) => !v);
              }}
              aria-expanded={verPropuesta}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Sparkles className="size-3.5" aria-hidden />
              {verPropuesta ? "Ocultar propuesta" : "Ver propuesta"}
            </button>
          )}
        </div>
      )}
      {verPista && comment.hint && (
        <p className="mt-2 rounded-[0.75rem] bg-muted/60 px-3 py-2 text-foreground/85">{comment.hint}</p>
      )}
      {verPropuesta && comment.suggestion && (
        <div className="mt-2 rounded-[0.75rem] border border-dashed border-[var(--ln2)] px-3 py-2">
          <p className="whitespace-pre-line font-serif text-[0.95rem] text-foreground">{comment.suggestion}</p>
          {abierto && anchor !== "missing" && (
            <Button
              size="xs"
              variant="outline"
              className="mt-2"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                aplicar();
              }}
            >
              Aplicar en el texto
            </Button>
          )}
        </div>
      )}

      {comment.replies.length > 0 && (
        <ol className="mt-3 space-y-2 border-t pt-3">
          {comment.replies.map((reply) => (
            <li key={reply.id} className="text-[0.85rem]">
              <span className="font-semibold text-foreground">{authorLabel(reply.author, reviewer)}</span>{" "}
              <span className="whitespace-pre-line text-foreground/85">{reply.body}</span>
            </li>
          ))}
        </ol>
      )}

      {comment.awaiting === "agent" && abierto && (
        <p className="mt-2 text-xs text-muted-foreground">Esperando a {reviewer ?? "tu agente"}.</p>
      )}

      {respondiendo && (
        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <Textarea
            autoFocus
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) responder();
              if (e.key === "Escape") setRespondiendo(false);
            }}
            placeholder={comment.author === "agent" ? `Contesta a ${firma}` : "Añade algo a tu pregunta"}
            className="min-h-16 text-sm"
            maxLength={BODY_MAX}
          />
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => setRespondiendo(false)}>
              Cancelar
            </Button>
            <Button size="xs" disabled={!borrador.trim() || pending} onClick={responder}>
              <CornerDownLeft aria-hidden />
              Responder
            </Button>
          </div>
        </div>
      )}

      {descartando && (
        <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          {MOTIVOS.map((motivo) => (
            <Button
              key={motivo}
              size="xs"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setDescartando(false);
                handlers.onDismiss(motivo);
              }}
            >
              {motivo}
            </Button>
          ))}
          <Button
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDescartando(false);
              handlers.onDismiss();
            }}
          >
            Sin motivo
          </Button>
        </div>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {abierto ? (
          <>
            <Button
              size="xs"
              disabled={pending}
              onClick={() => handlers.onResolve(anchor === "edited" || anchor === "missing" ? "edited" : "marked")}
            >
              <Check aria-hidden />
              {anchor === "edited" ? "Lo arreglé" : comment.reviewId ? "Resuelto" : "Cerrar"}
            </Button>
            {comment.reviewId && !descartando && (
              <Button size="xs" variant="ghost" className="px-2.5" disabled={pending} onClick={() => setDescartando(true)}>
                Descartar
              </Button>
            )}
            {!respondiendo && (
              <Button size="xs" variant="ghost" className="px-2.5" disabled={pending} onClick={() => setRespondiendo(true)}>
                Responder
              </Button>
            )}
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{cierre(comment, reviewer)}</span>
            <Button size="xs" variant="ghost" className="ml-auto" disabled={pending} onClick={handlers.onReopen}>
              <RotateCcw aria-hidden />
              Reabrir
            </Button>
          </>
        )}
      </footer>
    </article>
  );
}

/** Cómo se cerró, dicho en una línea. */
function cierre(comment: ReviewComment, reviewer: string | null): string {
  if (comment.status === "dismissed") return "Descartado";
  switch (comment.resolution) {
    case "edited":
      return "Lo arreglaste tú";
    case "applied":
      return "Aplicaste la propuesta";
    case "verified":
      return `Comprobado por ${reviewer ?? "tu agente"}`;
    default:
      return "Resuelto";
  }
}
