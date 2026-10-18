'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ListChecks, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
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
import { TaskFilterPanel } from './TaskFilterPanel';
import { TaskDetailSheet } from './TaskDetailSheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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

const FILTER_CHIP_LABELS: Partial<Record<keyof TaskFilters, string>> = {
  status: 'Estado', system: 'Sistema', priority: 'Prioridad',
  energy: 'Energía', type: 'Tipo', tag: 'Etiqueta', dateRange: 'Fecha',
  group: 'Agrupar', sort: 'Orden',
};

const GROUP_ORDER: Record<string, number> = {
  'Crítica': 0, 'Alta': 1, 'Media': 2, 'Baja': 3,
  'Hoy': 0, 'Mañana': 1, 'Esta semana': 2, 'Backlog': 3,
  'Completadas': 4, 'Archivadas': 5,
};

/**
 * Todas las tareas, como una sección de Diario: el título con la cuenta y un
 * hairline, una línea de herramientas (Filtros abre una hoja; las fichas de
 * los filtros activos se quitan de un toque) y las filas, sin caja. Las
 * vencidas van antes, en su propia sección. Completar tacha la fila en su
 * sitio con Deshacer; el título abre el detalle en una hoja; las acciones de
 * fila (seleccionar, enviar a la papelera) salen en una hoja en el teléfono y
 * en un menú en escritorio.
 */
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
  const [deleteTarget, setDeleteTarget] = useState<TaskTransport | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [cascadeOpen, setCascadeOpen] = useState(false);

  const toggleSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedTaskIds(new Set()), []);

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

  const removeFilterChip = (key: keyof TaskFilters) => {
    const reset: Partial<TaskFilters> = {};
    if (Array.isArray(filters[key])) reset[key] = [] as never;
    else reset[key] = (key === 'sort' ? DEFAULT_FILTERS.sort : '') as never;
    handleFiltersChange({ ...filters, ...reset });
  };

  const overdueTasks = useMemo(() => getOverdueTasks(tasks), [tasks]);
  const overdueIds = useMemo(() => new Set(overdueTasks.map((t) => t.id)), [overdueTasks]);

  // Las vencidas tienen su sección arriba: aquí no se repiten, salvo que un
  // filtro de fecha las pida a propósito.
  const filtered = useMemo(() => {
    const visible = applyFilters(
      tasks.filter((t) => t.parentTaskId === null && (filters.dateRange === 'overdue' || !overdueIds.has(t.id))),
      filters,
    );
    return [...visible].sort(SORTERS[filters.sort]);
  }, [tasks, filters, overdueIds]);

  const { filas, struck, handleToggle } = useListaTachable(filtered, (taskId) => toggleTask({ taskId }));

  // Active chips (only keys with values set)
  const activeChips = (Object.keys(FILTER_CHIP_LABELS) as (keyof TaskFilters)[]).filter((k) => {
    const v = filters[k];
    return Array.isArray(v) ? v.length > 0 : !!v && v !== 'priority' && v !== 'list';
  });
  const filterCount = countActiveFilters(filters);

  // Keyboard navigation: j/k move focus, x toggles selection, shift+j/k range-select
  const { focusedTaskId } = useTaskKeyboardNavigation(filtered, {
    onSelect: setSelectedTask,
    onSelectionToggle: toggleSelection,
  }, {
    enabled: !selectedTask && !deleteTarget,
  });

  // esc clears selection (only when something is selected, avoids conflicting with other esc handlers)
  useHotkey('escape', clearSelection, { enabled: selectedTaskIds.size > 0 });

  const seleccionando = selectedTaskIds.size > 0;

  function accionesDe(t: TaskTransport): TaskRowAction[] {
    return [
      {
        label: selectedTaskIds.has(t.id) ? 'Quitar de la selección' : 'Seleccionar',
        icon: ListChecks,
        onSelect: () => toggleSelection(t.id),
      },
      { label: 'Mover a la papelera', icon: Trash2, onSelect: () => setDeleteTarget(t), destructive: true },
    ];
  }

  function renderRows(items: readonly TaskTransport[]) {
    return (
      <div>
        {items.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            density="lista"
            className={LISTA_FILA_ALTO}
            struck={struck.has(t.id)}
            context={systemMap.get(t.systemId)?.name}
            focused={t.id === focusedTaskId}
            onComplete={() => handleToggle(t)}
            onOpen={() => setSelectedTask(t)}
            actions={accionesDe(t)}
            selection={{
              selected: selectedTaskIds.has(t.id),
              visible: seleccionando,
              onToggle: () => toggleSelection(t.id),
            }}
          />
        ))}
      </div>
    );
  }

  function renderGrouped(items: readonly TaskTransport[]) {
    if (!filters.group) return renderRows(items);
    const grouped = groupTasks([...items], filters.group);
    const keys = [...grouped.keys()].sort(
      (a, b) => (GROUP_ORDER[a] ?? 99) - (GROUP_ORDER[b] ?? 99),
    );
    return (
      <div>
        {keys.map((key) => {
          const groupItems = grouped.get(key) ?? [];
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
      {!seleccionando && (
        <OverdueGroup
          tasks={overdueTasks}
          systemMap={systemMap}
          onOpen={setSelectedTask}
          onToggle={(id) => toggleTask({ taskId: id })}
        />
      )}

      <section aria-labelledby="todas-titulo">
        <SectionHead id="todas-titulo" title="Todas las tareas" count={isLoading ? undefined : cuenta} />

        {/* Herramientas: la hoja de filtros y las fichas de lo que está activo. */}
        <div className="flex flex-wrap items-center gap-1.5 py-2 pl-(--margen)">
          <Button size="sm" variant="secondary" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal className="size-4" />
            Filtros
            {filterCount > 0 && <span className="tabular-nums">{filterCount}</span>}
          </Button>
          {activeChips.map((key) => (
            <Button
              key={key}
              size="sm"
              variant="ghost"
              onClick={() => removeFilterChip(key)}
              aria-label={`Quitar el filtro ${FILTER_CHIP_LABELS[key]}`}
              className="text-foreground"
            >
              {FILTER_CHIP_LABELS[key]}
              <X className="size-3.5 text-muted-foreground" />
            </Button>
          ))}
        </div>

        <BulkActionBar
          selectedIds={selectedTaskIds}
          onClear={clearSelection}
          onVaciar={seleccionando ? () => setCascadeOpen(true) : undefined}
        />

        {isLoading ? (
          <ListaSkeleton filas={6} />
        ) : filas.length === 0 ? (
          filterCount > 0 ? (
            <EmptyState
              className="pl-(--margen)"
              title="Nada con esos filtros"
              description="Quita uno y la lista vuelve."
              action={
                <Button
                  variant="secondary"
                  onClick={() => handleFiltersChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
                >
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
      </section>

      <ResponsiveDialog open={showFilters} onOpenChange={setShowFilters}>
        <ResponsiveDialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Filtros</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Cada toque filtra la lista al momento.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <TaskFilterPanel filters={filters} systems={systems} onChange={handleFiltersChange} />
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Mover a la papelera"
        description={`"${deleteTarget?.title}" se moverá a la papelera.`}
        confirmLabel="Mover a la papelera"
        onConfirm={() => {
          if (deleteTarget) deleteTask(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <CascadeInboxMode
        tasks={filtered.filter((t) => selectedTaskIds.has(t.id))}
        open={cascadeOpen}
        onOpenChange={(open) => {
          setCascadeOpen(open);
          if (!open) clearSelection();
        }}
      />
    </>
  );
}
