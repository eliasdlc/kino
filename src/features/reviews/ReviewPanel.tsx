"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardCopy, MessageCircleQuestion, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { celebrate } from "@/features/writing/celebrate";
import { BODY_MAX } from "@convex/lib/reviews";
import { useReviewUi } from "./ReviewContext";
import { CommentCard } from "./CommentCard";
import { ReviewProgressBar } from "./ReviewProgressBar";
import { ASK_LABEL, agentPrompt, nextAsk } from "./agent-prompt";
import { closingSummary } from "./closing-summary";
import { workOrder } from "./review-labels";
import { askSchema } from "./reviews.schemas";
import {
  useAskAboutText,
  useDismissComment,
  usePageReview,
  useReopenComment,
  useReplyToComment,
  useResolveComment,
} from "./reviews.hooks";
import type { PageReviewView, ReviewComment } from "./reviews.types";

type Pestana = "open" | "closed";

/**
 * El panel de revisión. En escritorio es una columna junto al texto, para que
 * el comentario y su fragmento se vean a la vez; en el teléfono no cabe un
 * margen, así que es una hoja que sube desde abajo y deja el texto a la vista
 * por encima, y se recorre con anterior y siguiente.
 */
export function ReviewPanel({ pageId, title }: { pageId: string; title: string | null }) {
  const ui = useReviewUi();
  const isMobile = useIsMobile();
  if (!ui) return null;

  if (isMobile) {
    return (
      <Drawer open={ui.open} onOpenChange={ui.setOpen} repositionInputs={false}>
        <DrawerContent className="max-h-[72dvh]">
          <DrawerTitle className="sr-only">Revisión</DrawerTitle>
          <ReviewPanelBody pageId={pageId} title={title} />
        </DrawerContent>
      </Drawer>
    );
  }

  if (!ui.open) return null;
  return (
    <aside aria-label="Revisión" className="hidden w-[22rem] shrink-0 flex-col border-l bg-card md:flex">
      <ReviewPanelBody pageId={pageId} title={title} />
    </aside>
  );
}

export function ReviewPanelBody({
  pageId,
  title,
  initialData,
}: {
  pageId: string;
  title: string | null;
  /** Lo que se pinta mientras llega la suscripción. */
  initialData?: PageReviewView;
}) {
  const ui = useReviewUi()!;
  const { data } = usePageReview(pageId, initialData);
  const [pestana, setPestana] = useState<Pestana>("open");
  const listRef = useRef<HTMLDivElement>(null);

  const resolve = useResolveComment();
  const dismiss = useDismissComment();
  const reopen = useReopenComment();
  const reply = useReplyToComment();
  const pending = resolve.isPending || dismiss.isPending || reopen.isPending || reply.isPending;

  const comments = useMemo(() => data?.comments ?? [], [data]);
  const posiciones = useMemo(() => new Map(ui.anchors.order.map((id, i) => [id, i])), [ui.anchors.order]);
  const abiertos = useMemo(() => workOrder(comments.filter((c) => c.status === "open"), posiciones), [comments, posiciones]);
  const cerrados = useMemo(() => comments.filter((c) => c.status !== "open"), [comments]);
  const visibles = pestana === "open" ? abiertos : cerrados;
  const reviewerDe = useMemo(() => {
    const porId = new Map((data?.reviews ?? []).map((r) => [r.id, r.reviewer]));
    return (c: ReviewComment) => (c.reviewId ? (porId.get(c.reviewId) ?? null) : (data?.reviews[0]?.reviewer ?? null));
  }, [data]);

  // La celebración sale cuando la base ya dice que todo está cerrado, no al
  // volver la mutación: así la frase del cierre cuenta también el último.
  const porCelebrar = useRef(false);
  const progress = data?.progress;
  useEffect(() => {
    if (!porCelebrar.current || !progress || progress.total === 0 || progress.open > 0) return;
    porCelebrar.current = false;
    celebrate({ icon: Trophy, title: "Revisión cerrada", detail: closingSummary(progress) || undefined });
  }, [progress]);

  const { activeId, setActiveId, editor } = ui;

  function activar(id: string | null, saltar = true) {
    setActiveId(id);
    if (!id) return;
    if (saltar) editor.current?.jumpTo(id);
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-comment-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }

  /** Tras cerrar uno, el siguiente abierto se enciende solo: el trabajo sigue sin buscarlo. */
  function siguienteTras(id: string) {
    const i = abiertos.findIndex((c) => c.id === id);
    const resto = abiertos.filter((c) => c.id !== id);
    if (resto.length === 0) return null;
    return (resto[Math.min(Math.max(i, 0), resto.length - 1)] ?? resto[0])!.id;
  }

  function trasCerrar(id: string) {
    return {
      onSuccess: ({ reviewClosed }: { reviewClosed: boolean }) => {
        if (reviewClosed) porCelebrar.current = true;
        if (activeId === id || activeId === null) activar(siguienteTras(id));
      },
    };
  }

  const indice = activeId ? abiertos.findIndex((c) => c.id === activeId) : -1;
  function paso(delta: number) {
    if (abiertos.length === 0) return;
    const next = indice === -1 ? 0 : (indice + delta + abiertos.length) % abiertos.length;
    setPestana("open");
    activar(abiertos[next]!.id);
  }

  const latest = data?.reviews[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Revisión</p>
        {abiertos.length > 0 && (
          <div className="ml-auto flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label="Comentario anterior" onClick={() => paso(-1)}>
              <ChevronLeft />
            </Button>
            <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
              {indice === -1 ? `${abiertos.length} por cerrar` : `${indice + 1} de ${abiertos.length}`}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Comentario siguiente" onClick={() => paso(1)}>
              <ChevronRight />
            </Button>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("hidden md:inline-flex", abiertos.length === 0 && "ml-auto")}
          aria-label="Cerrar la revisión"
          onClick={() => ui.setOpen(false)}
        >
          <X />
        </Button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {data && data.progress.total > 0 && <ReviewProgressBar progress={data.progress} />}
        {latest?.summary && <Veredicto text={latest.summary} reviewer={latest.reviewer} />}

        <PedirAlAgente pageId={pageId} title={title} data={data} />

        {comments.length > 0 && (
          <div role="tablist" aria-label="Comentarios" className="flex gap-1 rounded-full bg-muted p-1">
            {(
              [
                ["open", `Por cerrar (${abiertos.length})`],
                ["closed", `Cerrados (${cerrados.length})`],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={pestana === valor}
                onClick={() => setPestana(valor)}
                className={cn(
                  "min-h-9 flex-1 rounded-full px-3 text-xs font-semibold transition-colors",
                  pestana === valor ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        )}

        {pestana === "open" && abiertos.length === 0 && cerrados.length > 0 && (
          <p className="text-sm text-muted-foreground">No queda nada por cerrar en este documento.</p>
        )}

        <div className="space-y-2.5">
          {visibles.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              reviewer={reviewerDe(comment)}
              anchor={comment.status === "open" ? (ui.anchors.states.get(comment.id) ?? null) : null}
              active={comment.id === activeId}
              pending={pending}
              onActivate={() => activar(comment.id)}
              onResolve={(resolution) => resolve.mutate({ id: comment.id, resolution }, trasCerrar(comment.id))}
              onDismiss={(reason) => dismiss.mutate({ id: comment.id, reason }, trasCerrar(comment.id))}
              onReopen={() => reopen.mutate({ id: comment.id })}
              onReply={(body) => reply.mutate({ id: comment.id, body })}
              onApply={(text) => editor.current?.apply(comment.id, text) ?? false}
            />
          ))}
        </div>

        <Preguntar pageId={pageId} />
      </div>
    </div>
  );
}

/** El veredicto de conjunto de la última pasada, recogido a tres líneas. */
function Veredicto({ text, reviewer }: { text: string; reviewer: string | null }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="rounded-[1.125rem] bg-muted/60 px-3.5 py-3 text-sm">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{reviewer ?? "Tu agente"} dice</p>
      <p className={cn("whitespace-pre-line text-foreground/90", !abierto && "line-clamp-3")}>{text}</p>
      {text.length > 180 && (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary"
          aria-expanded={abierto}
        >
          {abierto ? "Menos" : "Leer entero"}
          <ChevronDown className={cn("size-3.5 transition-transform", abierto && "rotate-180")} aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * Pedirle la revisión al agente es pegarle una frase. Kino no llama a ningún
 * modelo: la frase lleva el id de la página y el nombre de las tools para que
 * el agente no tenga que adivinar de qué documento se habla.
 */
function PedirAlAgente({ pageId, title, data }: { pageId: string; title: string | null; data: PageReviewView | undefined }) {
  const [ver, setVer] = useState(false);
  const input = {
    pageId,
    title,
    hasReviews: (data?.reviews.length ?? 0) > 0,
    awaitingAgent: data?.awaitingAgent ?? 0,
  };
  const ask = nextAsk(input);
  const prompt = agentPrompt(input, ask);
  const vacio = !data || (data.reviews.length === 0 && data.comments.length === 0);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Instrucción copiada", { description: "Pégala en Claude Code o en el agente que tenga el conector de Kino." });
    } catch {
      setVer(true);
      toast.error("No se pudo copiar. Selecciónala abajo y cópiala a mano.");
    }
  }

  return (
    <div className={cn("space-y-2", vacio && "rounded-[1.125rem] border border-dashed border-[var(--ln2)] p-4")}>
      {vacio && (
        <p className="text-sm text-foreground/85">
          Dale este documento a tu agente para que lo revise. Deja comentarios sobre el texto, cada uno con su porqué, y
          tú los vas cerrando.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant={vacio ? "default" : "outline"} onClick={copiar}>
          <ClipboardCopy aria-hidden />
          {ASK_LABEL[ask]}
        </Button>
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-expanded={ver}
          className="min-h-10 whitespace-nowrap rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {ver ? "Ocultar" : "Ver la instrucción"}
        </button>
      </div>
      {ver && (
        <p className="select-all rounded-[0.75rem] bg-muted/60 px-3 py-2 font-mono text-xs leading-relaxed text-foreground/85">
          {prompt}
        </p>
      )}
    </div>
  );
}

/** Una pregunta sobre lo que está marcado en el texto, para que el agente la conteste en su hilo. */
function Preguntar({ pageId }: { pageId: string }) {
  const ui = useReviewUi()!;
  const ask = useAskAboutText(pageId);
  const [cita, setCita] = useState<{ quote: string; prefix: string; suffix: string } | null>(null);
  const [borrador, setBorrador] = useState("");

  function empezar() {
    const seleccion = ui.editor.current?.selection() ?? null;
    if (!seleccion) {
      toast("Marca primero en el texto el fragmento sobre el que quieres preguntar.");
      return;
    }
    setCita(seleccion);
  }

  function enviar() {
    const parsed = askSchema.safeParse({ body: borrador });
    if (!cita || !parsed.success) return;
    ask.mutate(
      { quote: cita.quote.slice(0, 1000), prefix: cita.prefix || undefined, suffix: cita.suffix || undefined, body: parsed.data.body },
      {
        onSuccess: (comment) => {
          setCita(null);
          setBorrador("");
          ui.setActiveId(comment.id);
        },
      },
    );
  }

  if (!cita) {
    return (
      <button
        type="button"
        onClick={empezar}
        className="flex min-h-11 w-full items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MessageCircleQuestion className="size-4" aria-hidden />
        Preguntar sobre lo marcado
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-[1.125rem] border p-3.5">
      <blockquote className="line-clamp-2 border-l-2 border-[var(--ln2)] pl-2.5 font-serif text-[0.9rem] italic text-muted-foreground">
        {cita.quote}
      </blockquote>
      <Textarea
        autoFocus
        value={borrador}
        maxLength={BODY_MAX}
        onChange={(e) => setBorrador(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviar();
          if (e.key === "Escape") setCita(null);
        }}
        placeholder="Qué quieres saber de este fragmento"
        className="min-h-16 text-sm"
      />
      <div className="flex justify-end gap-1.5">
        <Button size="xs" variant="ghost" onClick={() => setCita(null)}>
          Cancelar
        </Button>
        <Button size="xs" disabled={!borrador.trim() || ask.isPending} onClick={enviar}>
          Preguntar
        </Button>
      </div>
    </div>
  );
}
