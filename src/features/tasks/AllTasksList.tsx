'use client';

import { memo, useState, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Check, ListChecks, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { SectionHead } from '@/features/dashboard/SectionHead';
import {
  DEFAULT_FILTERS, parseFiltersFromParams, filtersToParams, countActiveFilters,
  applyFilters, SORTERS, groupTasks,
  type TaskFilters,
} from '@/lib/taskFilters';
import { useAllTasks, useToggleTodayTask, useDeleteAnyTaskWithUndo } from './tasks.hooks';
import { TaskRow, type TaskRowAction } from './TaskRow';
import {
  TaskFilterPanel,
  DATE_OPTIONS,
  ENERGY_OPTIONS,
  GROUP_OPTIONS,
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from './TaskFilterPanel';
import { TaskDetailSheet } from './TaskDetailSheet';
import { useTaskKeyboardNavigation } from './useTaskKeyboardNavigation';
import { useHotkey } from '@/shared/hooks/useHotkey';
import { useQuickAddStore } from './quick-add.store';
import { BulkActionBar } from './BulkActionBar';
import { CascadeInboxMode } from './CascadeInboxMode';
import { OverdueGroup, getOverdueTasks } from './OverdueGroup';
import { useListaTachable } from './useTachar';
import { LISTA_FILA_ALTO, ListaSkeleton } from './TasksSkeleton';
import type { TaskTransport } from './tasks.types';

interface SystemInfo {
  id: string;
  name: string;
  color: string | null;
}

interface AllTasksListProps {
  systems: SystemInfo[];
}

/** Una ficha de filtro activo: dice el valor que quita, no el nombre del campo. */
interface FichaActiva {
  key: keyof TaskFilters;
  /** El valor que quita, en los filtros de varios valores. */
  value?: string;
  label: string;
}

function palabra(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Las fichas de lo que está filtrado, una por valor: "Crítica", "Energía
 * alta", "Próximos 7 días". Antes decían "Prioridad" o "Fecha", y para saber
 * qué filtraban había que reabrir la hoja.
 */
function fichasActivas(filters: TaskFilters, systems: readonly SystemInfo[]): FichaActiva[] {
  const fichas: FichaActiva[] = [];
  for (const v of filters.status) fichas.push({ key: 'status', value: v, label: palabra(STATUS_OPTIONS, v) });
  for (const v of filters.system) fichas.push({ key: 'system', value: v, label: systems.find((s) => s.id === v)?.name ?? 'Un sistema' });
  for (const v of filters.priority) fichas.push({ key: 'priority', value: v, label: `Prioridad ${palabra(PRIORITY_OPTIONS, v).toLowerCase()}` });
  for (const v of filters.energy) fichas.push({ key: 'energy', value: v, label: `Energía ${palabra(ENERGY_OPTIONS, v).toLowerCase()}` });
  for (const v of filters.type) fichas.push({ key: 'type', value: v, label: palabra(TYPE_OPTIONS, v) });
  if (filters.tag.length > 0) fichas.push({ key: 'tag', label: filters.tag.length === 1 ? 'Una etiqueta' : `${filters.tag.length} etiquetas` });
  if (filters.dateRange) fichas.push({ key: 'dateRange', label: palabra(DATE_OPTIONS, filters.dateRange) });
  if (filters.group) fichas.push({ key: 'group', label: `Por ${palabra(GROUP_OPTIONS, filters.group).toLowerCase()}` });
  if (filters.sort !== DEFAULT_FILTERS.sort) fichas.push({ key: 'sort', label: `Orden: ${palabra(SORT_OPTIONS, filters.sort).toLowerCase()}` });
  return fichas;
}

const GROUP_ORDER: Record<string, number> = {
  'Crítica': 0, 'Alta': 1, 'Media': 2, 'Baja': 3,
  'Hoy': 0, 'Mañana': 1, 'Esta semana': 2, 'Backlog': 3,
  'Completadas': 4, 'Archivadas': 5,
};

/**
 * Todas las tareas, como una sección de Diario: el título con la cuenta y un
 * hairline, una línea de herramientas (Filtros abre una hoja con la cuenta
 * viva, Limpiar y "Ver N tareas"; Seleccionar enseña las casillas de todas las
 * filas; las fichas dicen el valor que quitan) y las filas, sin caja. Las
 * vencidas van antes, en su propia sección, con las mismas acciones.
 * Completar tacha la fila en su sitio con Deshacer; el título abre el detalle
 * en una hoja; mover a la papelera no pregunta, el aviso trae Deshacer. Con
 * algo elegido, la barra de la selección se pega al pie de la pantalla.
 */
interface Manejadores {
  completar: (task: TaskTransport) => void;
  abrir: (task: TaskTransport) => void;
  elegir: (taskId: string) => void;
  borrar: (taskId: string) => void;
}

/**
 * Una fila de Todas las tareas, memoizada: sólo vuelve a pintarse si cambia
 * su tarea o su estado (tachada, con foco, elegida). Los manejadores llegan
 * estables desde la lista.
 */
const FilaDeTodas = memo(function FilaDeTodas({
  task,
  struck,
  context,
  focused,
  selected,
  seleccionando,
  h,
}: {
  task: TaskTransport;
  struck: boolean;
  context?: string;
  focused: boolean;
  selected: boolean;
  seleccionando: boolean;
  h: Manejadores;
}) {
  return (
    <TaskRow
      task={task}
      density="lista"
      className={LISTA_FILA_ALTO}
      struck={struck}
      context={context}
      focused={focused}
      onComplete={() => h.completar(task)}
      onOpen={() => h.abrir(task)}
      actions={[
        { label: selected ? 'Quitar de la selección' : 'Seleccionar', icon: ListChecks, onSelect: () => h.elegir(task.id) },
        { label: 'Mover a la papelera', icon: Trash2, onSelect: () => h.borrar(task.id), destructive: true },
      ]}
      selection={{ selected, visible: seleccionando, onToggle: () => h.elegir(task.id) }}
    />
  );
});

export function AllTasksList({ systems }: AllTasksListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: tasks = [], isLoading } = useAllTasks();
  const { mutate: toggleTask } = useToggleTodayTask();
  const { mutate: deleteTask } = useDeleteAnyTaskWithUndo();
  const { setOpen: setQuickAddOpen } = useQuickAddStore();

  const filters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams]);
  const [showFilters, setShowFilters] = useState(false);
  const [elegida, setSelectedTask] = useState<TaskTransport | null>(null);
  // `?tarea=<id>` es el enlace de una notificación o de un correo: abre esa
  // tarea al llegar. Se busca en la lista ya suscrita en vez de pedirla aparte,
  // y un enlace a una tarea que ya no está simplemente no abre nada.
  const tareaEnlazada = searchParams.get('tarea');
  const enlazada = useMemo(
    () => (tareaEnlazada ? (tasks.find((t) => t.id === tareaEnlazada) ?? null) : null),
    [tareaEnlazada, tasks],
  );
  const selectedTask = elegida ?? enlazada;
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  // Seleccionar sin pasar por la hoja de cada fila: el botón enseña las
  // casillas de todas y se elige de un toque.
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [cascadeOpen, setCascadeOpen] = useState(false);

  const toggleSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
    setModoSeleccion(false);
  }, []);

  const systemMap = useMemo(
    () => new Map(systems.map((s) => [s.id, s])),
    [systems],
  );

  const handleFiltersChange = useCallback(
    (next: TaskFilters) => {
      const params = filtersToParams(next);
      // La vista de la página (Lista o Calendario) usa `view`; los filtros ya
      // no tienen rejilla, así que no la escriben.
      params.delete('view');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const quitarFicha = ({ key, value }: FichaActiva) => {
    const reset: Partial<TaskFilters> = {};
    const actual = filters[key];
    if (Array.isArray(actual)) reset[key] = (value === undefined ? [] : actual.filter((v) => v !== value)) as never;
    else reset[key] = (key === 'sort' ? DEFAULT_FILTERS.sort : '') as never;
    handleFiltersChange({ ...filters, ...reset });
  };
  const limpiarFiltros = () => handleFiltersChange({ ...DEFAULT_FILTERS, sort: filters.sort });

  const overdueTasks = useMemo(() => getOverdueTasks(tasks), [tasks]);
  const vencidas = useListaTachable(overdueTasks, (taskId) => toggleTask({ taskId }));
  // Una vencida tachada en esta visita sigue en su sección y no se cuenta como
  // una más de Todas: si no, al dejar de estar vencida aparecería también
  // abajo, como fila hecha, y empujaría lo que hay debajo.
  const overdueIds = useMemo(
    () => new Set([...overdueTasks.map((t) => t.id), ...vencidas.struck]),
    [overdueTasks, vencidas.struck],
  );

  // Las vencidas tienen su sección arriba: aquí no se repiten, salvo que un
  // filtro de fecha las pida a propósito.
  const filtered = useMemo(() => {
    const visible = applyFilters(
      tasks.filter((t) => t.parentTaskId === null && (filters.dateRange === 'overdue' || !overdueIds.has(t.id))),
      filters,
    );
    return [...visible].sort(SORTERS[filters.sort]);
  }, [tasks, filters, overdueIds]);

  const { filas, struck, handleToggle, estadoDe } = useListaTachable(filtered, (taskId) => toggleTask({ taskId }));

  const fichas = fichasActivas(filters, systems);
  const filterCount = countActiveFilters(filters);

  // j y k recorren lo que se ve, en el orden en que se ve: las vencidas y
  // luego todas, con las tachadas en su sitio. x elige, shift+j/k elige un
  // tramo.
  const navegables = useMemo(
    () => [...(vencidas.filas as TaskTransport[]), ...(filas as TaskTransport[])],
    [vencidas.filas, filas],
  );
  const { focusedTaskId } = useTaskKeyboardNavigation(navegables, {
    onSelect: setSelectedTask,
    onSelectionToggle: toggleSelection,
  }, {
    enabled: !selectedTask && !showFilters,
  });

  // esc clears selection (only when something is selected, avoids conflicting with other esc handlers)
  useHotkey('escape', clearSelection, { enabled: selectedTaskIds.size > 0 || modoSeleccion });

  const seleccionando = selectedTaskIds.size > 0 || modoSeleccion;

  function accionesDe(t: TaskTransport): TaskRowAction[] {
    return [
      {
        label: selectedTaskIds.has(t.id) ? 'Quitar de la selección' : 'Seleccionar',
        icon: ListChecks,
        onSelect: () => toggleSelection(t.id),
      },
      { label: 'Mover a la papelera', icon: Trash2, onSelect: () => deleteTask(t.id), destructive: true },
    ];
  }

  function filaDe(t: TaskTransport) {
    return {
      actions: accionesDe(t),
      selection: {
        selected: selectedTaskIds.has(t.id),
        visible: seleccionando,
        onToggle: () => toggleSelection(t.id),
      },
    };
  }

  // Las filas de Todas reciben manejadores estables (leen los del último
  // render por una ref, puesta antes de pintar), así que completar una no
  // vuelve a pintar las otras 199.
  const manejadores = useRef<Manejadores | null>(null);
  useLayoutEffect(() => {
    manejadores.current = { completar: handleToggle, abrir: setSelectedTask, elegir: toggleSelection, borrar: deleteTask };
  }, [handleToggle, toggleSelection, deleteTask]);
  const estables = useMemo<Manejadores>(
    () => ({
      completar: (t) => manejadores.current?.completar(t),
      abrir: (t) => manejadores.current?.abrir(t),
      elegir: (id) => manejadores.current?.elegir(id),
      borrar: (id) => manejadores.current?.borrar(id),
    }),
    [],
  );

  function renderRows(items: readonly TaskTransport[]) {
    return (
      <div>
        {items.map((t) => (
          <FilaDeTodas
            key={t.id}
            task={t}
            struck={struck.has(t.id)}
            context={systemMap.get(t.systemId)?.name}
            focused={t.id === focusedTaskId}
            selected={selectedTaskIds.has(t.id)}
            seleccionando={seleccionando}
            h={estables}
          />
        ))}
      </div>
    );
  }

  function renderGrouped(items: readonly TaskTransport[]) {
    if (!filters.group) return renderRows(items);
    // Se agrupa por el estado de antes de tachar: una fila tachada se queda en
    // su grupo hasta la siguiente visita en vez de saltar a Completadas.
    const porId = new Map(items.map((t) => [t.id, t]));
    const grouped = groupTasks(items.map((t) => ({ ...t, status: estadoDe(t) })), filters.group);
    const keys = [...grouped.keys()].sort(
      (a, b) => (GROUP_ORDER[a] ?? 99) - (GROUP_ORDER[b] ?? 99),
    );
    return (
      <div>
        {keys.map((key) => {
          const groupItems = (grouped.get(key) ?? []).map((t) => porId.get(t.id)!);
          const groupName = filters.group === 'system'
            ? (systemMap.get(key)?.name ?? key)
            : key;
          return (
            <div key={key}>
              <div className="flex items-baseline gap-2 border-b border-border pt-4 pb-1.5 pl-(--margen)">
                <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{groupName}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{groupItems.length}</span>
              </div>
              {renderRows(groupItems)}
            </div>
          );
        })}
      </div>
    );
  }

  const cuenta = [
    `${filtered.length} tarea${filtered.length === 1 ? '' : 's'}`,
    filterCount > 0 ? `${filterCount} filtro${filterCount === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <OverdueGroup
        tasks={overdueTasks}
        filas={vencidas.filas}
        struck={vencidas.struck}
        systemMap={systemMap}
        onOpen={setSelectedTask}
        onComplete={vencidas.handleToggle}
        focusedTaskId={focusedTaskId}
        filaDe={filaDe}
      />

      <section aria-labelledby="todas-titulo">
        <SectionHead id="todas-titulo" title="Todas las tareas" />

        {/* Herramientas: la cuenta, la hoja de filtros, la selección y las
            fichas de lo que está activo, cada una con el valor que quita. La
            cuenta va aquí y no junto al título: en el teléfono lo partía en
            dos líneas. */}
        <div className="flex flex-wrap items-center gap-1.5 py-2 pl-(--margen)">
          {!isLoading && <span className="mr-1 text-[0.84rem] text-muted-foreground tabular-nums">{cuenta}</span>}
          <Button size="sm" variant="secondary" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal className="size-4" />
            Filtros
            {filterCount > 0 && <span className="tabular-nums">{filterCount}</span>}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={seleccionando}
            onClick={() => (seleccionando ? clearSelection() : setModoSeleccion(true))}
          >
            {seleccionando ? <Check className="size-4" /> : <ListChecks className="size-4" />}
            {seleccionando ? 'Terminar' : 'Seleccionar'}
          </Button>
          {fichas.map((ficha) => (
            <Button
              key={`${ficha.key}-${ficha.value ?? ''}`}
              size="sm"
              variant="ghost"
              onClick={() => quitarFicha(ficha)}
              aria-label={`Quitar el filtro ${ficha.label}`}
              className="text-foreground"
            >
              {ficha.label}
              <X className="size-3.5 text-muted-foreground" />
            </Button>
          ))}
        </div>

        {isLoading ? (
          <ListaSkeleton filas={6} />
        ) : filas.length === 0 ? (
          filterCount > 0 ? (
            <EmptyState
              className="pl-(--margen)"
              title="Nada con esos filtros"
              description="Quita uno y la lista vuelve."
              action={
                <Button variant="secondary" onClick={limpiarFiltros}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              className="pl-(--margen)"
              title={overdueTasks.length > 0 ? 'Sólo quedan las vencidas' : 'Una página en blanco'}
              description={overdueTasks.length > 0 ? 'Lo de arriba es todo lo que hay.' : 'La primera tarea empieza la lista.'}
              action={
                <Button onClick={() => setQuickAddOpen(true)}>
                  <Plus className="size-5" />
                  Nueva tarea
                </Button>
              }
            />
          )
        ) : (
          renderGrouped(filas)
        )}

        <BulkActionBar
          selectedIds={selectedTaskIds}
          onClear={clearSelection}
          onVaciar={selectedTaskIds.size > 0 ? () => setCascadeOpen(true) : undefined}
        />
      </section>

      <ResponsiveDialog open={showFilters} onOpenChange={setShowFilters}>
        <ResponsiveDialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Filtros</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Cada toque filtra la lista al momento; abajo, cuántas quedan.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <TaskFilterPanel filters={filters} systems={systems} onChange={handleFiltersChange} />
          {/* El pie de la hoja: la cuenta viva y las dos salidas, al alcance
              del pulgar aunque la lista quede tapada. */}
          <div
            data-slot="filtros-pie"
            className="sticky bottom-0 z-10 -mx-4 -mb-[calc(1rem+env(safe-area-inset-bottom))] flex gap-2 border-t border-border bg-popover px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:-mx-5 md:-mb-5 md:px-5 md:pb-5"
          >
            <Button variant="secondary" disabled={filterCount === 0} onClick={limpiarFiltros}>
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setShowFilters(false)}>
              Ver {filtered.length} tarea{filtered.length === 1 ? '' : 's'}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <TaskDetailSheet
        task={selectedTask}
        systemId={selectedTask?.systemId ?? ''}
        open={selectedTask !== null}
        onComplete={(t) => handleToggle(t)}
        onOpenChange={(open) => {
          if (open) return;
          setSelectedTask(null);
          if (tareaEnlazada) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('tarea');
            const qs = params.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname);
          }
        }}
      />

      <CascadeInboxMode
        tasks={navegables.filter((t) => selectedTaskIds.has(t.id))}
        open={cascadeOpen}
        onOpenChange={(open) => {
          setCascadeOpen(open);
          if (!open) clearSelection();
        }}
      />
    </>
  );
}
