"use client";

import { useEffect, useId, useRef, useState } from "react";
import { addDays, format, isBefore, isSameDay, isToday, startOfDay, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MarginRow } from "@/components/ui/margin-row";
import { RowsSkeleton } from "@/components/Skeletons";
import { SectionHead } from "@/features/dashboard/SectionHead";
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
  /** Las tareas de la semana todavía no llegaron: el día se pinta como esqueleto, no como vacío. */
  cargando?: boolean;
  /** Abre la hoja con nombre que sustituye al arrastre. */
  onProgramar: (task: TaskTransport) => void;
  /** Abre el detalle de la tarea. */
  onOpenTask: (task: TaskTransport) => void;
  /** El círculo de la fila: completa la tarea (o la devuelve si ya estaba hecha). */
  onComplete: (task: TaskTransport) => void;
  /** El nivel del título de la página: el catálogo lo baja para no meter un h1 de más. */
  tituloComo?: "h1" | "h2";
}

/** La inicial de cada día, de domingo a sábado; miércoles es X, como en un calendario de pared. */
const INICIAL = ["D", "L", "M", "X", "J", "V", "S"];

const ENERGIA: Record<string, string> = { high: "alta", medium: "media", low: "baja" };
const PRIORIDAD: Record<string, string> = { critical: "crítica", high: "alta" };

/**
 * "25 min", "1 h", "1 h 30" de una estimación "HH:MM"; nada si no la hay. No se
 * exporta: `duracionLegible` de las capturas es otra cosa (segundos a "m:ss").
 */
function estimacionLegible(tiempo: string | null | undefined): string | null {
  if (!tiempo) return null;
  const [h = 0, m = 0] = tiempo.split(":").map(Number);
  if (!h && !m) return null;
  // Espacio duro: la cifra y su unidad no se separan al partir el renglón.
  if (!h) return `${m}\u00a0min`;
  return m ? `${h}\u00a0h\u00a0${m}` : `${h}\u00a0h`;
}

interface ParteDeMeta {
  clave: string;
  texto: string;
  /** Lo que se dice con peso (vencida, prioridad) va en negrita; el resto, suelto. */
  peso?: string;
}

/** Las partes de la línea de meta de una fila: el estado con su palabra, la prioridad en peso, la energía. */
function partesDeMeta(task: TaskTransport): ParteDeMeta[] {
  const fecha = getPlacementDate(task);
  const hecha = task.status === "done";
  const vencida = !hecha && fecha !== null && isBefore(startOfDay(parseDueDate(fecha)), startOfToday());
  const prioridad = PRIORIDAD[task.effectivePriority];
  const duracion = estimacionLegible(task.estimatedTime);
  const partes: ParteDeMeta[] = [];
  if (hecha) partes.push({ clave: "hecha", texto: "hecha", peso: "font-semibold text-ok" });
  if (vencida) partes.push({ clave: "vencida", texto: "vencida", peso: "font-semibold text-task-overdue" });
  if (prioridad) partes.push({ clave: "prioridad", texto: prioridad, peso: "font-semibold text-body" });
  partes.push({ clave: "energia", texto: `energía ${ENERGIA[task.energyLevel ?? "medium"] ?? "media"}` });
  if (duracion) partes.push({ clave: "duracion", texto: duracion });
  return partes;
}

/** La línea de meta de una fila. */
function Meta({ task }: { task: TaskTransport }) {
  return (
    <span className="block text-sm text-muted-foreground">
      {partesDeMeta(task).map(({ clave, texto, peso }, i) => (
        <span key={clave}>
          {i > 0 && ", "}
          {peso ? <b className={peso}>{texto}</b> : texto}
        </span>
      ))}
    </span>
  );
}

function Titulo({ task, className }: { task: TaskTransport; className?: string }) {
  const hecha = task.status === "done";
  return (
    <span
      className={cn(
        "block font-semibold leading-snug text-foreground",
        task.effectivePriority === "critical" && "font-bold",
        hecha && "text-muted-foreground line-through",
        className,
      )}
    >
      {task.title}
    </span>
  );
}

/** Una sección del día: el título de Hoy (`SectionHead`) y sus filas. */
function Seccion({ id, titulo, cuenta, children }: { id: string; titulo: string; cuenta: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-1">
      <SectionHead id={id} title={titulo} count={cuenta} />
      <div>{children}</div>
    </section>
  );
}

/**
 * La fila de una tarea del día. El margen lleva la hora o el glifo; el título
 * y la meta son el botón que abre el detalle; a la derecha, las dos acciones
 * que se hacen desde un calendario sin abrir el formulario: moverla (la misma
 * hoja que programa) y completarla con el círculo de 48 px de Hoy y Bandeja.
 *
 * Por debajo de 360 px las dos acciones lado a lado dejaban unos 100 px al
 * título: ahí se apilan (el círculo arriba, a la altura del título, y Mover
 * debajo) y el título gana casi 50 px. El título se corta en tres renglones
 * en cualquier ancho; el detalle lo trae entero.
 */
function FilaDelDia({
  task,
  margen,
  etiqueta,
  onOpen,
  onMover,
  onComplete,
}: {
  task: TaskTransport;
  margen: React.ReactNode;
  /** Lo que el lector de pantalla lee antes del título: la hora o «Todo el día». La meta se le suma. */
  etiqueta: string;
  onOpen: () => void;
  onMover: () => void;
  onComplete: () => void;
}) {
  const hecha = task.status === "done";
  return (
    <MarginRow
      className="group"
      margin={margen}
      trailing={
        <span className="-mr-2 inline-flex items-center max-[360px]:flex-col-reverse">
          {!hecha && (
            <Button variant="ghost" size="icon" aria-label={`Mover ${task.title}`} onClick={onMover} className="text-muted-foreground">
              <CalendarClock />
            </Button>
          )}
          <button
            type="button"
            onClick={onComplete}
            aria-label={`Completar ${task.title}`}
            aria-pressed={hecha}
            className="press focus-ring flex size-[2.85rem] items-center justify-center rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma)"
          >
            <span
              aria-hidden
              className={cn(
                "flex size-[1.35rem] items-center justify-center rounded-full border-[1.6px] transition-[background-color,border-color,transform] duration-(--dur-tachar) ease-(--ease-pluma)",
                hecha ? "border-task-done bg-task-done text-task-done-foreground" : "border-input group-hover:border-foreground/60",
              )}
            >
              {hecha && <Check className="size-3" strokeWidth={3} />}
            </span>
          </button>
        </span>
      }
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={[etiqueta, ...partesDeMeta(task).map((parte) => parte.texto)].join(", ")}
        className="focus-ring -my-2 block min-h-[2.85rem] w-full rounded-md py-2 text-left"
      >
        <Titulo task={task} className="line-clamp-3" />
        <Meta task={task} />
      </button>
    </MarginRow>
  );
}

/**
 * La tira de la semana: siete días de 2.85rem o más, con un punto por tarea
 * hasta tres. El día elegido va en tinta, que es estado y no acción; hoy lleva
 * el numeral en ámbar y `aria-current`, porque es dónde estás.
 *
 * La tira llega hasta el canto del papel (sale del padding de la página) y
 * cada pista mide al menos 2.85rem: desde 360 px caben las siete; en 320 se
 * desplaza unos píxeles en horizontal y el día elegido se trae a la vista, en
 * vez de encimar las áreas de toque.
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
  const tira = useRef<HTMLElement>(null);
  useEffect(() => {
    const elegido = tira.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    // jsdom no hace layout ni trae scrollIntoView.
    elegido?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selectedDay]);

  return (
    <nav
      ref={tira}
      aria-label="Días de la semana"
      className="sticky top-0 z-(--z-raised) -mr-[max(1.25rem,env(safe-area-inset-right))] -ml-[max(1.25rem,env(safe-area-inset-left))] grid snap-x grid-cols-[repeat(7,minmax(2.85rem,1fr))] overflow-x-auto overscroll-x-contain border-b border-border bg-background px-2 py-2 [scrollbar-width:none]"
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
              "press focus-ring flex min-h-[3.6rem] min-w-[2.85rem] snap-center flex-col items-center justify-center gap-0.5 rounded-full transition-[background-color,color,transform] duration-(--dur-toque) ease-(--ease-pluma)",
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
 * el día llevan el glifo del día. Tocar una fila abre su detalle; su círculo
 * la completa y "Mover" la cambia de hora, o la pasa a todo el día, dentro del día
 * elegido, con la misma hoja con la que se programan las que no tienen
 * fecha, que esperan abajo.
 *
 * Sin rejilla de horas vacías: diecisiete filas que no hacen nada eran una
 * rejilla de adorno, y el hueco ya lo dice la hora del margen.
 *
 * La cabecera son dos renglones para que quepa desde 320 px: el título con
 * Hoy, y la fecha con las flechas de la semana.
 */
export function GlobalCalendarMobileView({
  selectedDay,
  onSelectDay,
  byDayAllDay,
  timedByDay,
  unscheduledTasks,
  cargando = false,
  onProgramar,
  onOpenTask,
  onComplete,
  tituloComo: Titular = "h1",
}: GlobalCalendarMobileViewProps) {
  const ids = useId();
  const idSinProgramar = `${ids}-sin-programar`;
  const idLista = `${ids}-sin-programar-lista`;
  const [verSinProgramar, setVerSinProgramar] = useState(false);
  const sinProgramar = useRef<HTMLElement>(null);
  const todoElDia = byDayAllDay.get(dayKey(selectedDay)) ?? [];
  const conHora = timedTasksOfDay(timedByDay, selectedDay);
  const diaVacio = !cargando && todoElDia.length === 0 && conHora.length === 0;
  const fecha = format(selectedDay, "EEEE d 'de' MMMM", { locale: es });

  /** El vacío del día lleva a las que esperan fecha: abre la lista y la trae a la vista. */
  function abrirSinProgramar() {
    setVerSinProgramar(true);
    requestAnimationFrame(() => sinProgramar.current?.scrollIntoView?.({ block: "start" }));
  }

  return (
    <div
      data-slot="page"
      className="w-full space-y-5 py-5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]"
    >
      <header className="grid grid-cols-[var(--margen)_minmax(0,1fr)_auto] items-center gap-y-0.5">
        <span aria-hidden />
        <Titular className="truncate font-display text-[1.41rem] font-bold tracking-[-0.02em]">Calendario</Titular>
        <Button variant="secondary" className="justify-self-end" onClick={() => onSelectDay(startOfToday())}>
          Hoy
        </Button>
        <p className="col-start-2 font-voice text-base italic leading-snug text-body first-letter:uppercase" aria-live="polite">
          {fecha}
        </p>
        <div className="-mr-2 flex items-center">
          <Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => onSelectDay(addDays(selectedDay, -7))}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Semana siguiente" onClick={() => onSelectDay(addDays(selectedDay, 7))}>
            <ChevronRight />
          </Button>
        </div>
      </header>

      <TiraSemana
        selectedDay={selectedDay}
        onSelectDay={onSelectDay}
        carga={(day) => dayLoad(byDayAllDay, timedByDay, day)}
      />

      {cargando && (
        <div aria-hidden>
          <RowsSkeleton rows={3} margin="numeral" />
        </div>
      )}

      {diaVacio && (
        <EmptyState
          className="pl-(--margen)"
          title="Nada con fecha este día"
          description="Lo que tenga día u hora aparece aquí."
          action={
            unscheduledTasks.length > 0 ? (
              <Button variant="secondary" onClick={abrirSinProgramar}>
                {unscheduledTasks.length === 1 ? "Ver la que no tiene fecha" : `Ver las ${unscheduledTasks.length} sin fecha`}
              </Button>
            ) : undefined
          }
        />
      )}

      {conHora.length > 0 && (
        <Seccion id={`${ids}-con-hora`} titulo="Con hora" cuenta={conHora.length}>
          {conHora.map((task) => (
            <FilaDelDia
              key={task.id}
              task={task}
              etiqueta={`${placementTime(task)}, ${task.title}`}
              margen={
                <span data-slot="hora" className="block pt-2.5 text-[0.84rem] font-semibold whitespace-nowrap text-muted-foreground tabular-nums">{placementTime(task)}</span>
              }
              onOpen={() => onOpenTask(task)}
              onMover={() => onProgramar(task)}
              onComplete={() => onComplete(task)}
            />
          ))}
        </Seccion>
      )}

      {todoElDia.length > 0 && (
        <Seccion id={`${ids}-todo-el-dia`} titulo="Todo el día" cuenta={todoElDia.length}>
          {todoElDia.map((task) => (
            <FilaDelDia
              key={task.id}
              task={task}
              etiqueta={`Todo el día, ${task.title}`}
              margen={
                <span className="block pt-2">
                  <CalendarDays className="size-5" aria-hidden />
                </span>
              }
              onOpen={() => onOpenTask(task)}
              onMover={() => onProgramar(task)}
              onComplete={() => onComplete(task)}
            />
          ))}
        </Seccion>
      )}

      <section ref={sinProgramar} aria-labelledby={idSinProgramar} className="scroll-mt-20">
        <button
          type="button"
          onClick={() => setVerSinProgramar((v) => !v)}
          aria-expanded={verSinProgramar}
          aria-controls={idLista}
          className="press focus-ring flex min-h-[2.85rem] w-full items-baseline justify-between gap-3 border-b border-input pb-[0.45rem] text-left transition-transform duration-(--dur-toque) ease-(--ease-pluma)"
        >
          <span id={idSinProgramar} className="flex items-baseline gap-2 font-display text-[1.25rem] leading-[1.15] font-bold tracking-[-0.02em]">
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
          <div id={idLista}>
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
