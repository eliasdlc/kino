"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useFolders } from "@/features/folders/folders.hooks";
import { useUpdateSystem } from "@/features/systems/systems.hooks";
import { ENTITY_TYPE_ICON } from "@/features/entities/entities.ui";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import { useLooseThreads, useResolveThread } from "./writing.hooks";
import { CHEKHOV_LIMITS, threadSummary, type LooseThread } from "./chekhov";
import type { SystemTransport } from "@/features/systems/systems.types";

/**
 * Detector de hilos sueltos (KIN-137). *"La Daga apareció en el capítulo 2 y
 * nunca más."*
 *
 * No inventa nada: cada señalamiento dice en qué capítulo fue y se verifica en un
 * clic. Y se puede cerrar a mano: una entidad de fondo nombrada una vez a
 * propósito no es un cabo suelto, y un detector que grita demasiado se ignora.
 *
 * Diario: cada hilo es una fila con el glifo de su clase en el margen, sin
 * caja; cerrarlo a mano se ve en un dedo y aparece al pasar en escritorio; la
 * sensibilidad es una hoja con nombre en el teléfono.
 */
export function LooseThreads({ system }: { system: SystemTransport }) {
  const { data: works = [] } = useFolders(system.id);
  const [folderId, setFolderId] = useState<string | null>(null);
  const activeFolderId = folderId ?? works[0]?.id ?? null;
  const { data, isLoading } = useLooseThreads(activeFolderId);
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  const { open, resolved } = useMemo(() => {
    const threads = data?.threads ?? [];
    return {
      open: threads.filter((t) => !t.resolved),
      resolved: threads.filter((t) => t.resolved),
    };
  }, [data]);

  if (works.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay obras que revisar"
        description="Los hilos sueltos se miden dentro de una obra: cuántos capítulos lleva callada una entidad que apenas se nombró."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={activeFolderId ?? undefined}
          onValueChange={setFolderId}
        >
          <SelectTrigger className="w-full sm:w-64" aria-label="Obra a revisar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {works.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SensitivityPopover system={system} />
      </div>

      {isLoading ? (
        <div aria-busy className="space-y-px">
          <Skeleton className="h-[4.6rem] w-full rounded-md" />
          <Skeleton className="h-[4.6rem] w-full rounded-md" />
        </div>
      ) : (data?.chapterCount ?? 0) === 0 ? (
        <Empty
          title="Esta obra no tiene capítulos"
          hint="El silencio se cuenta en capítulos. Escribe uno y el detector empieza a mirar."
        />
      ) : open.length === 0 ? (
        <Empty
          title="Ningún hilo suelto"
          hint={`Con el criterio actual (hasta ${data?.settings.maxMentions} menciones y ${data?.settings.minSilentChapters} capítulos de silencio) no hay nada olvidado en esta obra.`}
        />
      ) : (
        <ul>
          {open.map((thread) => (
            <ThreadRow
              key={thread.entityId}
              thread={thread}
              systemId={system.id}
              folderId={activeFolderId!}
              onOpen={() => setOpenEntityId(thread.entityId)}
            />
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <details className="border-t border-border">
          <summary className="flex min-h-[2.85rem] cursor-pointer items-center rounded-md pl-(--margen) text-sm text-muted-foreground focus-ring hover:text-foreground">
            {resolved.length === 1
              ? "1 hilo cerrado a mano"
              : `${resolved.length} hilos cerrados a mano`}
          </summary>
          <ul>
            {resolved.map((thread) => (
              <ThreadRow
                key={thread.entityId}
                thread={thread}
                systemId={system.id}
                folderId={activeFolderId!}
                onOpen={() => setOpenEntityId(thread.entityId)}
              />
            ))}
          </ul>
        </details>
      )}

      <EntityFicheSheet
        entityId={openEntityId}
        systemId={system.id}
        open={openEntityId !== null}
        onOpenChange={(o) => !o && setOpenEntityId(null)}
      />
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return <EmptyState title={title} description={hint} />;
}

function ThreadRow({
  thread,
  systemId,
  folderId,
  onOpen,
}: {
  thread: LooseThread;
  systemId: string;
  folderId: string;
  onOpen: () => void;
}) {
  const Icon = ENTITY_TYPE_ICON[thread.type];
  const { mutate: resolve, isPending } = useResolveThread(folderId);

  return (
    <li className="group grid grid-cols-[var(--margen)_1fr_auto] items-start border-b border-border py-2 last:border-b-0">
      <span className="flex h-[2.15rem] items-center justify-center text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </span>

      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "block max-w-full truncate rounded-md py-1 text-left text-base font-semibold focus-ring hover:underline",
            thread.resolved ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {thread.name}
        </button>
        <p className="text-sm text-muted-foreground">
          {thread.totalMentions === 1 ? "1 mención" : `${thread.totalMentions} menciones`}
          {thread.reopened ? ", retomado" : ""}
        </p>
        <p className="mt-1 text-sm text-body">{threadSummary(thread)}</p>
        <Link
          href={`/systems/${systemId}/pages/${thread.lastChapter.id}`}
          className="inline-flex min-h-9 items-center rounded-md text-sm font-medium text-primary underline-offset-2 focus-ring hover:underline pointer-coarse:min-h-[2.85rem]"
        >
          Ir a esa aparición
        </Link>
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        aria-busy={isPending || undefined}
        onClick={() => resolve({ entityId: thread.entityId, resolved: !thread.resolved })}
        className="shrink-0 gap-1.5 text-muted-foreground md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        {thread.resolved ? (
          <>
            <RotateCcw aria-hidden className="size-4" />
            Reabrir
          </>
        ) : (
          <>
            <Check aria-hidden className="size-4" />
            Es deliberado
          </>
        )}
      </Button>
    </li>
  );
}

/**
 * Los dos umbrales. Se guardan en el sistema porque son una preferencia del
 * escritor sobre cuánto quiere que le hablen, no del manuscrito.
 */
function SensitivityPopover({ system }: { system: SystemTransport }) {
  const { mutate: updateSystem } = useUpdateSystem();
  const current = system.metadata?.chekhov ?? { maxMentions: 3, minSilentChapters: 3 };
  const [draft, setDraft] = useState(current);

  function commit(next: { maxMentions: number; minSilentChapters: number }) {
    setDraft(next);
    updateSystem({
      systemId: system.id,
      // `systems.update` fusiona la metadata por clave: basta con mandar la que
      // cambia, y reenviar las demás podría pisar lo que el servidor escribió
      // entre medias, como el cursor de GitHub.
      data: { metadata: { chekhov: next } },
    });
  }

  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <Settings2 aria-hidden className="size-4" />
          Sensibilidad
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-w-sm space-y-5">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Sensibilidad del detector</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Un detector que grita demasiado se ignora. Sube el silencio exigido si te
            está señalando cosas que son a propósito.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-2">
          <Label className="flex items-center justify-between text-sm">
            <span>Se nombró como mucho</span>
            <span className="text-muted-foreground tabular-nums">
              {draft.maxMentions} {draft.maxMentions === 1 ? "vez" : "veces"}
            </span>
          </Label>
          <Slider
            value={[draft.maxMentions]}
            min={CHEKHOV_LIMITS.maxMentions.min}
            max={12}
            step={1}
            onValueChange={([v]) => setDraft({ ...draft, maxMentions: v! })}
            onValueCommit={([v]) => commit({ ...draft, maxMentions: v! })}
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center justify-between text-sm">
            <span>Lleva callada al menos</span>
            <span className="text-muted-foreground tabular-nums">
              {draft.minSilentChapters}{" "}
              {draft.minSilentChapters === 1 ? "capítulo" : "capítulos"}
            </span>
          </Label>
          <Slider
            value={[draft.minSilentChapters]}
            min={CHEKHOV_LIMITS.minSilentChapters.min}
            max={12}
            step={1}
            onValueChange={([v]) => setDraft({ ...draft, minSilentChapters: v! })}
            onValueCommit={([v]) => commit({ ...draft, minSilentChapters: v! })}
          />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
