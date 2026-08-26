"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, RotateCcw, Scissors, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
 * clic. Y se puede cerrar a mano — una entidad de fondo nombrada una vez a
 * propósito no es un cabo suelto, y un detector que grita demasiado se ignora.
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
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Scissors className="mx-auto size-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium">Todavía no hay obras que revisar</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Los hilos sueltos se miden dentro de una obra: cuántos capítulos lleva
          callada una entidad que apenas se nombró.
        </p>
      </div>
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
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (data?.chapterCount ?? 0) === 0 ? (
        <Empty
          title="Esta obra no tiene capítulos"
          hint="El silencio se cuenta en capítulos. Escribe uno y el detector empieza a mirar."
        />
      ) : open.length === 0 ? (
        <Empty
          title="Ningún hilo suelto"
          hint={`Con el criterio actual —hasta ${data?.settings.maxMentions} menciones y ${data?.settings.minSilentChapters} capítulos de silencio— no hay nada olvidado en esta obra.`}
          celebratory
        />
      ) : (
        <ul className="space-y-2">
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
        <details className="rounded-lg border bg-muted/10 px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {resolved.length === 1
              ? "1 hilo cerrado a mano"
              : `${resolved.length} hilos cerrados a mano`}
          </summary>
          <ul className="mt-2 space-y-2">
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

function Empty({
  title,
  hint,
  celebratory,
}: {
  title: string;
  hint: string;
  celebratory?: boolean;
}) {
  const Icon = celebratory ? Sparkles : Scissors;
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <Icon className="mx-auto size-8 text-muted-foreground/40" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>
    </div>
  );
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
    <li
      className={cn(
        "group flex items-start gap-3 rounded-lg border bg-card p-3",
        thread.resolved && "opacity-60",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="truncate text-sm font-medium hover:underline"
          >
            {thread.name}
          </button>
          {thread.reopened && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">
              retomado
            </span>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {thread.totalMentions === 1
              ? "1 mención"
              : `${thread.totalMentions} menciones`}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">{threadSummary(thread)}</p>

        <Link
          href={`/systems/${systemId}/pages/${thread.lastChapter.id}`}
          className="inline-block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Ir a esa aparición
        </Link>
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => resolve({ entityId: thread.entityId, resolved: !thread.resolved })}
        className="shrink-0 gap-1.5 text-muted-foreground md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        {thread.resolved ? (
          <>
            <RotateCcw className="size-3.5" />
            Reabrir
          </>
        ) : (
          <>
            <Check className="size-3.5" />
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
      // La metadata se reemplaza entera en el PATCH: hay que arrastrar lo demás
      // (meta diaria, composición) o se pierde al mover un slider.
      data: { metadata: { ...(system.metadata ?? {}), chekhov: next } },
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="size-4" />
          Sensibilidad
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-5">
        <p className="text-xs text-muted-foreground">
          Un detector que grita demasiado se ignora. Sube el silencio exigido si te
          está señalando cosas que son a propósito.
        </p>

        <div className="space-y-2">
          <Label className="flex items-center justify-between text-xs">
            <span>Se nombró como mucho</span>
            <span className="font-mono text-muted-foreground">
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
          <Label className="flex items-center justify-between text-xs">
            <span>Lleva callada al menos</span>
            <span className="font-mono text-muted-foreground">
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
      </PopoverContent>
    </Popover>
  );
}
