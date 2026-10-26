"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { endOfWeek, format, startOfToday, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { useCalendarTasks, useUpdateCalendarTask, useAllTasks, useToggleTask } from "@/features/tasks/tasks.hooks";
import { dayToLocalISO } from "@/features/tasks/tasks.utils";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { useTodayEnergyPlan } from "@/features/energy/energy.hooks";
import { GlobalCalendarMobileView } from "./GlobalCalendarMobileView";
import { EsqueletoCalendarioEscritorio } from "./CalendarioEsqueleto";
import { ProgramarSheet, type Programacion } from "./ProgramarSheet";
import type { DatosDelCalendario } from "./CalendarioEscritorio";
import { dayKey, groupTasksByDay, occupiedHoursForDay, suggestHour } from "./calendar.layout";

/** Lo que dura el Deshacer de una tarea completada o movida desde el calendario, el de Hoy y Bandeja. */
export const DESHACER_MS = 4000;

/**
 * La rejilla de escritorio, con `@dnd-kit` dentro, en un trozo aparte: sin
 * render de servidor y sólo pedida cuando el ancho es de escritorio. El
 * teléfono ni la descarga ni la pinta.
 */
const CalendarioEscritorio = dynamic(() => import("./CalendarioEscritorio"), {
  ssr: false,
  loading: () => <EsqueletoCalendarioEscritorio />,
});

const ESCRITORIO = "(min-width: 768px)";

function suscribir(onChange: () => void) {
  const mql = window.matchMedia(ESCRITORIO);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Si el ancho es de escritorio. En el servidor y en la hidratación dice que
 * no: la rejilla de escritorio no se emite nunca en el HTML, así que una carga
 * dura en el teléfono no la pinta ni pide su trozo antes de saltar a la página
 * del día. En escritorio la rejilla entra justo después de hidratar, sobre su
 * esqueleto.
 */
function useEsEscritorio() {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(ESCRITORIO).matches,
    () => false,
  );
}

/** "a las 10:00 del jueves 23" o "todo el día del jueves 23". */
function cuandoQueda(dia: Date, hour: number | null): string {
  const fecha = format(dia, "EEEE d", { locale: es });
  return hour === null ? `todo el día del ${fecha}` : `a las ${hour.toString().padStart(2, "0")}:00 del ${fecha}`;
}

/**
 * El calendario global. El teléfono y el escritorio son dos componentes
 * hermanos y lo visible lo decide el CSS (`md:hidden`, `hidden md:flex`):
 * el HTML sólo trae la página del día, y la rejilla de escritorio se monta
 * después de hidratar y sólo si el ancho lo es. Los datos, el detalle de la
 * tarea y la hoja de programar son de los dos.
 */
export function GlobalCalendarView() {
  const today = startOfToday();
  const esEscritorio = useEsEscritorio();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [abierta, setAbierta] = useState<TaskTransport | null>(null);
  const [programando, setProgramando] = useState<TaskTransport | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const from = weekStart.toISOString();
  const to = weekEnd.toISOString();

  const { data: calendarTasks = [] } = useCalendarTasks(from, to);
  const { data: allTasks = [] } = useAllTasks();
  const { mutate: updateTask } = useUpdateCalendarTask(from, to);
  const { mutate: toggle } = useToggleTask("");
  const { data: energyPlan } = useTodayEnergyPlan();
  const projectedCurve = energyPlan?.projectedCurve;

  const unscheduledTasks = useMemo(
    () => allTasks.filter((t) => !t.dueDate && !t.startDate && t.status !== "done" && !t.deletedAt),
    [allTasks],
  );
  const byDayAllDay = useMemo(() => groupTasksByDay(calendarTasks, { timed: false }), [calendarTasks]);
  const timedByDay = useMemo(() => groupTasksByDay(calendarTasks, { timed: true }), [calendarTasks]);
  const ocupadas = useMemo(() => occupiedHoursForDay(calendarTasks, selectedDay), [calendarTasks, selectedDay]);

  // Memorizados: la rejilla de escritorio es `memo` y no vuelve a pintar sus
  // 119 huecos cuando sólo se abre el detalle o la hoja.
  const sugerencia = useCallback(
    (task: TaskTransport) =>
      projectedCurve?.length === 24 ? suggestHour(task.energyLevel ?? "medium", projectedCurve, ocupadas) : null,
    [projectedCurve, ocupadas],
  );
  const datos: DatosDelCalendario = useMemo(
    () => ({ byDayAllDay, timedByDay, unscheduledTasks, sugerencia }),
    [byDayAllDay, timedByDay, unscheduledTasks, sugerencia],
  );

  const handleSelectDay = useCallback(
    (day: Date) => {
      setSelectedDay(day);
      const newWeekStart = startOfWeek(day, { weekStartsOn: 1 });
      if (newWeekStart.getTime() !== weekStart.getTime()) setWeekStart(newWeekStart);
    },
    [weekStart],
  );

  /**
   * La misma escritura que soltar en un hueco (con hora) o en "Todo el día"
   * (sin ella), y una línea que dice dónde quedó: con otro día elegido, o con
   * "Con hora" fuera de la pantalla, la hoja se cerraba sin decir nada. Como
   * completar, se deshace 4 s: mover a "Todo el día" borra la hora, y sin
   * Deshacer la de antes no se veía en ningún sitio.
   */
  const programar = useCallback(
    (task: TaskTransport, { hour }: Programacion) => {
      const dia = dayKey(selectedDay);
      const antes = { startDate: task.startDate ?? null, dueDate: task.dueDate ?? null };
      if (hour === null) {
        updateTask({ taskId: task.id, data: { startDate: null, dueDate: dayToLocalISO(dia) } });
      } else {
        updateTask({ taskId: task.id, data: { startDate: dayToLocalISO(dia, `${hour.toString().padStart(2, "0")}:00`) } });
      }
      toast(`${task.title}, ${cuandoQueda(selectedDay, hour)}`, {
        duration: DESHACER_MS,
        action: { label: "Deshacer", onClick: () => updateTask({ taskId: task.id, data: antes }) },
      });
    },
    [selectedDay, updateTask],
  );

  const aceptarSugerencia = useCallback(
    (task: TaskTransport, hour: number) => programar(task, { hour }),
    [programar],
  );

  /** Completar desde el día: el círculo la tacha y el aviso ofrece Deshacer 4 s. */
  const completar = useCallback(
    (task: TaskTransport) => {
      toggle(task.id);
      if (task.status === "done") return;
      toast(`Hecha: ${task.title}`, {
        duration: DESHACER_MS,
        action: { label: "Deshacer", onClick: () => toggle(task.id) },
      });
    },
    [toggle],
  );

  return (
    <>
      {!esEscritorio && (
        <div className="md:hidden">
          <GlobalCalendarMobileView
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            byDayAllDay={byDayAllDay}
            timedByDay={timedByDay}
            unscheduledTasks={unscheduledTasks}
            onProgramar={setProgramando}
            onOpenTask={setAbierta}
            onComplete={completar}
          />
        </div>
      )}
      <div className="hidden h-full md:flex">
        {esEscritorio ? (
          <CalendarioEscritorio
            datos={datos}
            weekStart={weekStart}
            onWeekStart={setWeekStart}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            projectedCurve={projectedCurve ?? []}
            onUpdate={updateTask}
            onProgramar={setProgramando}
            onOpenTask={setAbierta}
            onAcceptSuggestion={aceptarSugerencia}
          />
        ) : (
          <EsqueletoCalendarioEscritorio />
        )}
      </div>

      <ProgramarSheet
        task={programando}
        day={selectedDay}
        open={programando !== null}
        onOpenChange={(next) => !next && setProgramando(null)}
        suggestedHour={programando ? sugerencia(programando) : null}
        onSchedule={programar}
      />
      <TaskDetailSheet
        task={abierta}
        systemId={abierta?.systemId ?? ""}
        open={abierta !== null}
        onOpenChange={(next) => !next && setAbierta(null)}
      />
    </>
  );
}
