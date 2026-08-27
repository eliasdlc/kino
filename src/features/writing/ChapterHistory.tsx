"use client";

import { useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SanitizedHtml } from "@/shared/components/SanitizedHtml";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRestoreSnapshot, useSnapshot, useSnapshots } from "./writing.hooks";
import { MAX_SNAPSHOTS_PER_PAGE } from "./snapshots";

/**
 * Historial del capítulo (KIN-142). Una versión por sesión de escritura — el
 * corte lo pone el mismo detector que alimenta la racha desde W4.
 *
 * Restaurar guarda antes el estado actual, así que volver atrás nunca es la
 * operación que te hace perder lo que tenías; se puede volver a deshacer.
 */
export function ChapterHistory({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Historial
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 justify-start gap-2 px-2 text-sm font-normal"
        onClick={() => setOpen(true)}
      >
        <History className="size-3.5 shrink-0" />
        Versiones del capítulo
      </Button>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Versiones del capítulo</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {open && <HistoryBody pageId={pageId} />}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function HistoryBody({ pageId }: { pageId: string }) {
  const { data: snapshots = [], isLoading } = useSnapshots(pageId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { mutate: restore, isPending } = useRestoreSnapshot(pageId);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Todavía no hay versiones. Se guarda una cada vez que vuelves al capítulo
        después de un rato — el mismo corte que usa la racha para saber que fue
        otra sesión.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Una versión por sesión de escritura. Se conservan las últimas{" "}
        {MAX_SNAPSHOTS_PER_PAGE}.
      </p>

      <ul className="space-y-1.5">
        {snapshots.map((snapshot, i) => (
          <li
            key={snapshot.id}
            className="rounded-lg border bg-card p-2.5"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-medium">
                {formatWhen(snapshot.createdAt)}
              </span>
              {i === 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">
                  la más reciente
                </span>
              )}
              <span className="font-mono text-xs text-muted-foreground">
                {snapshot.wordCount.toLocaleString("es")} palabras
              </span>
              <Delta value={snapshot.wordsDelta} />

              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setPreviewId((id) => (id === snapshot.id ? null : snapshot.id))
                  }
                >
                  {previewId === snapshot.id ? "Ocultar" : "Ver"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  disabled={isPending}
                  onClick={() => setConfirmId(snapshot.id)}
                >
                  <RotateCcw className="size-3.5" />
                  Restaurar
                </Button>
              </div>
            </div>

            {previewId === snapshot.id && <Preview snapshotId={snapshot.id} />}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirmId !== null}
        title="¿Volver a esta versión?"
        description="El texto actual se guarda como una versión más antes de reemplazarlo, así que esto se puede deshacer."
        confirmLabel="Restaurar"
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          const id = confirmId;
          setConfirmId(null);
          if (!id) return;
          restore(id, {
            onSuccess: () => toast.success("Capítulo restaurado"),
            onError: () => toast.error("No se pudo restaurar la versión"),
          });
        }}
      />
    </div>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span
      className={cn(
        "font-mono text-xs",
        value > 0 ? "text-muted-foreground" : "text-amber-500",
      )}
    >
      {value > 0 ? "+" : ""}
      {value.toLocaleString("es")}
    </span>
  );
}

function Preview({ snapshotId }: { snapshotId: string }) {
  const { data, isLoading } = useSnapshot(snapshotId);

  if (isLoading) {
    return (
      <div className="mt-2 flex h-16 items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SanitizedHtml
      html={data?.content}
      className="reading-surface mt-2 max-h-64 overflow-y-auto rounded-md border bg-muted/20 p-3 text-sm"
      data-layout="book"
    />
  );
}

/** Fecha larga y legible: el historial se lee, no se escanea. */
function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
