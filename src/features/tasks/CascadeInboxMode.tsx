"use client";

import { useState } from "react";
import { ArrowRight, CalendarClock, Check } from "lucide-react";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useIsMobile } from "@/hooks/use-mobile";
import { MarginRow } from "@/components/ui/margin-row";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useSystems } from "@/features/systems/systems.hooks";
import { useBulkMove } from "./tasks.hooks";
import { defaultTaskMeta } from "./TaskRow";
import type { TaskTransport } from "./tasks.types";
import { type TaskStatus } from "./tasks.state-machine";

interface CascadeInboxModeProps {
  tasks: TaskTransport[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Los destinos, con su tecla. La tecla sólo se enseña donde hay teclado. */
const DESTINOS: { status: TaskStatus | null; label: string; tecla: string; icon: typeof Check }[] = [
  { status: "today", label: "Para hoy", tecla: "H", icon: CalendarClock },
  { status: "tomorrow", label: "Para mañana", tecla: "M", icon: CalendarClock },
  { status: "week", label: "Para esta semana", tecla: "S", icon: CalendarClock },
  { status: "done", label: "Ya está hecha", tecla: "C", icon: Check },
  { status: null, label: "Saltar", tecla: "N", icon: ArrowRight },
];

/**
 * Repasar la selección una a una: cada tarea, con su sistema y su meta en
 * palabras, y los destinos en renglones de 48 px. En el teléfono es la hoja
 * inferior y no enseña teclas; con teclado, cada destino lleva la suya (H, M,
 * S, C, N) a la derecha, en mute. El avance es una barra que escala en
 * horizontal, no un ancho que se anima.
 */
export function CascadeInboxMode({ tasks, open, onOpenChange }: CascadeInboxModeProps) {
  const [index, setIndex] = useState(0);
  const { mutate: bulkMove } = useBulkMove();
  const { data: systems } = useSystems();
  const isMobile = useIsMobile();

  const task = tasks[index];
  const total = tasks.length;

  function advance() {
    if (index < total - 1) setIndex((i) => i + 1);
    else onOpenChange(false);
  }

  function choose(status: TaskStatus | null) {
    if (!task) return;
    if (status === null) {
      advance();
      return;
    }
    bulkMove({ taskIds: [task.id], status }, { onSuccess: advance });
  }

  useHotkey("h", () => choose("today"), { enabled: open });
  useHotkey("m", () => choose("tomorrow"), { enabled: open });
  useHotkey("s", () => choose("week"), { enabled: open });
  useHotkey("c", () => choose("done"), { enabled: open });
  useHotkey(["n", "ArrowRight"], () => advance(), { enabled: open });

  if (!task) return null;

  const sistema = systems?.find((s) => s.id === task.systemId)?.name;
  const meta = defaultTaskMeta(task, sistema);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Repasar una a una</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="tabular-nums">
            {index + 1} de {total}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="h-1 overflow-hidden rounded-full bg-sf2" aria-hidden>
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform duration-(--dur-tachar) ease-(--ease-pluma)"
            style={{ transform: `scaleX(${index / total})` }}
          />
        </div>

        <div className="py-2">
          <p className="text-lg leading-snug font-semibold text-foreground">{task.title}</p>
          <p className="mt-1 text-[0.82rem] leading-snug text-muted-foreground">
            {meta.map((m, i) => (
              <span key={i}>
                {i > 0 && ", "}
                {m}
              </span>
            ))}
          </p>
        </div>

        <div role="group" aria-label="Destino">
          {DESTINOS.map(({ status, label, tecla, icon: Icon }) => (
            <MarginRow
              key={label}
              margin={<Icon className="mt-[0.8rem] size-[1.15rem]" />}
              trailing={isMobile ? undefined : <kbd className="font-mono text-xs">{tecla}</kbd>}
              onClick={() => choose(status)}
              className="min-h-[3.2rem] text-base font-semibold text-foreground"
            >
              {label}
            </MarginRow>
          ))}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
