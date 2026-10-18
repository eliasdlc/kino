"use client";

import { useState } from "react";
import { addDays, format, isBefore, isSameDay, isToday, startOfDay, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MarginRow } from "@/components/ui/margin-row";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { parseDueDate } from "@/features/tasks/tasks.utils";
import { dayKey, dayLoad, getPlacementDate, placementTime, timedTasksOfDay, weekOf } from "./calendar.layout";

interface GlobalCalendarMobileViewProps {
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  byDayAllDay: Map<string, TaskTransport[]>;
  /** Las tareas con hora, por día: el mismo mapa que pinta la rejilla de escritorio. */
  timedByDay: Map<string, TaskTransport[]>;
  /** Las que no tienen fecha: en el teléfono también existen. */
  unscheduledTasks: TaskTransport[];
  /** Abre la hoja con nombre que sustituye al arrastre. */
  onProgramar: (task: TaskTransport) => void;
  /** Abre el detalle de la tarea. */
  onOpenTask: (task: TaskTransport) => void;
}

/** La inicial de cada día, de domingo a sábado; miércoles es X, como en un calendario de pared. */
const INICIAL = ["D", "L", "M", "X", "J", "V", "S"];

const ENERGIA: Record<string, string> = { high: "alta", medium: "media", low: "baja" };
const PRIORIDAD: Record<string, string> = { critical: "crítica", high: "alta" };

/** "25 min", "1 h", "1 h 30" de un "HH:MM"; nada si no hay estimación. */
export function duracionLegible(tiempo: string | null | undefined): string | null {
  if (!tiempo) return null;
  const [h = 0, m = 0] = tiempo.split(":").map(Number);
  if (!h && !m) return null;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m}` : `${h} h`;
}

/** La línea de meta de una fila: el estado con su palabra, la prioridad en peso, la energía. */
function Meta({ task }: { task: TaskTransport }) {
  const fecha = getPlacementDate(task);
  const hecha = task.status === "done";
  const vencida = !hecha && fecha !== null && isBefore(startOfDay(parseDueDate(fecha)), startOfToday());
  const prioridad = PRIORIDAD[task.effectivePriority];
  const duracion = duracionLegible(task.estimatedTime);
  const partes: React.ReactNode[] = [];
  if (hecha) partes.push(<span key="hecha" className="font-semibold text-ok">hecha</span>);
  if (vencida) partes.push(<b key="vencida" className="font-semibold text-task-overdue">vencida</b>);
  if (prioridad) partes.push(<b key="prioridad" className="font-semibold text-body">{prioridad}</b>);
  partes.push(<span key="energia">energía {ENERGIA[task.energyLevel ?? "medium"] ?? "media"}</span>);
  if (duracion) partes.push(<span key="duracion">{duracion}</span>);
  return (
    <span className="block text-sm text-muted-foreground">
      {partes.map((parte, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {parte}
        </span>
      ))}
    </span>
  );
}

function Titulo({ task }: { task: TaskTransport }) {
  const hecha = task.status === "done";
  return (
    <span
      className={cn(
        "block font-semibold leading-snug text-foreground",
        task.effectivePriority === "critical" && "font-bold",
        hecha && "text-muted-foreground line-through",
      )}
    >
      {task.title}
    </span>
  );
}

/**
 * El título de una sección del día: la palabra en Bricolage, la cuenta en
 * mute y un hairline fuerte debajo. Es la misma forma que `SectionHead` de
 * Hoy, que todavía no está en esta rama.
 */
function Seccion({ id, titulo, cuenta, children }: { id: string; titulo: string; cuenta: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 border-b border-input pb-[0.45rem]">
        <h2 id={id} className="font-display text-[1.25rem] leading-[1.15] font-bold tracking-[-0.02em]">
          {titulo}
        </h2>
        <span className="shrink-0 text-[0.84rem] text-muted-foreground tabular-nums">{cuenta}</span>
      </div>
      <div>{children}</div>
    </section>
  );
}

/**
 * La tira de la semana: siete días de 2.85rem o más, con un punto por tarea
 * hasta tres. El día elegido va en tinta, que es estado y no acción; hoy lleva
 * el numeral en ámbar y `aria-current`, porque es dónde estás.
 */
function TiraSemana({
  selectedDay,
  onSelectDay,
  carga,
}: {
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  carga: (day: Date) => number;
}) {
  return (
    <nav
      aria-label="Días de la semana"
      className="sticky top-0 z-(--z-raised) -mx-1 grid grid-cols-7 gap-0.5 border-b border-border bg-background px-1 py-2"
    >
      {weekOf(selectedDay).map((day) => {
        const elegido = isSameDay(day, selectedDay);
        const hoy = isToday(day);
        const puntos = carga(day);
        return (
          <button
            key={dayKey(day)}
            type="button"
            aria-pressed={elegido}
            aria-current={hoy ? "date" : undefined}
            aria-label={`${format(day, "EEEE d 'de' MMMM", { locale: es })}${puntos ? `, ${puntos === 3 ? "tres o más" : puntos} con fecha` : ""}`}
            onClick={() => onSelectDay(day)}
            className={cn(
              "press focus-ring flex min-h-[3.6rem] min-w-[2.85rem] flex-col items-center justify-center gap-0.5 rounded-full transition-[background-color,color,transform] duration-(--dur-toque) ease-(--ease-pluma)",
              elegido ? "bg-foreground text-background" : "hover:bg-sf2",
            )}
          >
            <span aria-hidden className={cn("text-xs font-semibold uppercase", elegido ? "text-background/75" : "text-muted-foreground")}>
              {INICIAL[day.getDay()]}
            </span>
            <span
              aria-hidden
              className={cn(
                "font-display text-[1.1rem] leading-none font-bold tabular-nums",
                !elegido && hoy && "text-primary",
              )}
            >
              {format(day, "d")}
            </span>
            <span aria-hidden className="flex h-1 items-center gap-0.5">
              {Array.from({ length: puntos }).map((_, i) => (
                <span key={i} className={cn("size-1 rounded-full", elegido ? "bg-background/70" : "bg-muted-foreground")} />
              ))}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * El calendario en el teléfono: una página del día con la semana encima. Las
 * tareas con hora llevan la hora en el margen y se leen en el orden en que
 * pasan, a cualquier hora (una a las 23:15 también es del día); las de todo
 * el día llevan el glifo del día. Tocar una fila abre su detalle. Las que no
 * tienen fecha esperan abajo y se programan con una hoja, no arrastrando.
 *
 * Sin rejilla de horas vacías: diecisiete filas que no hacen nada eran una
 * rejilla de adorno, y el hueco ya lo dice la hora del margen.
 */
export function GlobalCalendarMobileView({
  selectedDay,
  onSelectDay,
  byDayAllDay,
  timedByDay,
  unscheduledTasks,
  onProgramar,
  onOpenTask,
}: GlobalCalendarMobileViewProps) {
  const [verSinProgramar, setVerSinProgramar] = useState(false);
  const todoElDia = byDayAllDay.get(dayKey(selectedDay)) ?? [];
  const conHora = timedTasksOfDay(timedByDay, selectedDay);
  const diaVacio = todoElDia.length === 0 && conHora.length === 0;
  const fecha = format(selectedDay, "EEEE d 'de' MMMM", { locale: es });

  return (
    <div
      data-slot="page"
      className="w-full space-y-5 py-5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]"
    >
      <header className="grid grid-cols-[var(--margen)_1fr_auto] items-center gap-y-1">
        <span aria-hidden />
        <h1 className="font-display text-[1.41rem] font-bold tracking-[-0.02em]">Calendario</h1>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => onSelectDay(addDays(selectedDay, -7))}>
            <ChevronLeft />
          </Button>
          <Button variant="secondary" onClick={() => onSelectDay(startOfToday())}>
            Hoy
          </Button>
          <Button variant="ghost" size="icon" aria-label="Semana siguiente" onClick={() => onSelectDay(addDays(selectedDay, 7))}>
            <ChevronRight />
          </Button>
        </div>
        <p className="col-start-2 col-end-4 font-voice text-base italic leading-snug text-body first-letter:uppercase" aria-live="polite">
          {fecha}
        </p>
      </header>

      <TiraSemana
        selectedDay={selectedDay}
        onSelectDay={onSelectDay}
        carga={(day) => dayLoad(byDayAllDay, timedByDay, day)}
      />

      {diaVacio && (
        <EmptyState
          className="pl-(--margen)"
          title="Nada con fecha este día"
          description={
            unscheduledTasks.length > 0
              ? "Lo que tenga día u hora aparece aquí. Las que no tienen fecha esperan abajo."
              : "Lo que tenga día u hora aparece aquí."
          }
        />
      )}

      {conHora.length > 0 && (
        <Seccion id="cal-con-hora" titulo="Con hora" cuenta={conHora.length}>
          {conHora.map((task) => (
            <MarginRow
              key={task.id}
              onClick={() => onOpenTask(task)}
              aria-label={`${placementTime(task)}, ${task.title}`}
              margin={
                <span className="block pt-2 text-sm font-semibold text-muted-foreground tabular-nums">{placementTime(task)}</span>
              }
              trailing={<ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
            >
              <Titulo task={task} />
              <Meta task={task} />
            </MarginRow>
          ))}
        </Seccion>
      )}

      {todoElDia.length > 0 && (
        <Seccion id="cal-todo-el-dia" titulo="Todo el día" cuenta={todoElDia.length}>
          {todoElDia.map((task) => (
            <MarginRow
              key={task.id}
              onClick={() => onOpenTask(task)}
              margin={
                <span className="block pt-2">
                  {task.status === "done" ? (
                    <Check className="size-5 text-ok" aria-hidden />
                  ) : (
                    <CalendarDays className="size-5" aria-hidden />
                  )}
                </span>
              }
              trailing={<ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
            >
              <Titulo task={task} />
              <Meta task={task} />
            </MarginRow>
          ))}
        </Seccion>
      )}

      <section aria-labelledby="cal-sin-programar">
        <button
          type="button"
          onClick={() => setVerSinProgramar((v) => !v)}
          aria-expanded={verSinProgramar}
          aria-controls="cal-sin-programar-lista"
          className="press focus-ring flex min-h-[2.85rem] w-full items-baseline justify-between gap-3 border-b border-input pb-[0.45rem] text-left transition-transform duration-(--dur-toque) ease-(--ease-pluma)"
        >
          <span id="cal-sin-programar" className="flex items-baseline gap-2 font-display text-[1.25rem] leading-[1.15] font-bold tracking-[-0.02em]">
            Sin programar
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 self-center text-muted-foreground transition-transform duration-(--dur-toque) ease-(--ease-pluma)",
                !verSinProgramar && "-rotate-90",
              )}
            />
          </span>
          <span className="shrink-0 text-[0.84rem] text-muted-foreground tabular-nums">{unscheduledTasks.length}</span>
        </button>
        {verSinProgramar && (
          <div id="cal-sin-programar-lista">
            {unscheduledTasks.length === 0 ? (
              <p className="py-3 pl-(--margen) text-sm text-muted-foreground">Todo lo pendiente ya tiene fecha.</p>
            ) : (
              unscheduledTasks.map((task) => (
                <MarginRow
                  key={task.id}
                  margin={
                    <span className="block pt-2">
                      <CircleDashed className="size-5" aria-hidden />
                    </span>
                  }
                  trailing={
                    <Button variant="secondary" size="sm" aria-label={`Programar ${task.title}`} onClick={() => onProgramar(task)}>
                      Programar
                    </Button>
                  }
                >
                  <Titulo task={task} />
                  <Meta task={task} />
                </MarginRow>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
