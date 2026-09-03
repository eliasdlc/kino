'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus, SlidersHorizontal, LayoutList, LayoutGrid, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_FILTERS, parseFiltersFromParams, filtersToParams, countActiveFilters,
  applyFilters, SORTERS, groupTasks,
  type TaskFilters,
} from '@/lib/taskFilters';
import { useAllTasks, useToggleTodayTask, useDeleteAnyTaskWithUndo } from './tasks.hooks';
import { TaskListRow } from './TaskListRow';
import { TaskFilterPanel } from './TaskFilterPanel';
import { TaskDetailSheet } from './TaskDetailSheet';
import { DefaultTaskCard } from './cards/DefaultTaskCard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTaskKeyboardNavigation } from './useTaskKeyboardNavigation';
import { useHotkey } from '@/shared/hooks/useHotkey';
import { useQuickAddStore } from './quick-add.store';
import { BulkActionBar } from './BulkActionBar';
import { CascadeInboxMode } from './CascadeInboxMode';
import { OverdueGroup, getOverdueTasks } from './OverdueGroup';
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
  energy: 'Energía', type: 'Tipo', dateRange: 'Fecha',
  group: 'Agrupar', sort: 'Orden',
};

const GROUP_ORDER: Record<string, number> = {
  'Crítica': 0, 'Alta': 1, 'Media': 2, 'Baja': 3,
  'Hoy': 0, 'Mañana': 1, 'Esta semana': 2, 'Backlog': 3,
  'Completadas': 4, 'Archivadas': 5,
};

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
  const [selectedTask, setSelectedTask] = useState<TaskTransport | null>(null);
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
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const handleViewToggle = (view: TaskFilters['view']) => {
    handleFiltersChange({ ...filters, view });
  };

  const removeFilterChip = (key: keyof TaskFilters) => {
    const reset: Partial<TaskFilters> = {};
    if (Array.isArray(filters[key])) reset[key] = [] as never;
    else reset[key] = '' as never;
    handleFiltersChange({ ...filters, ...reset });
  };

  // Apply filters + sort
  const filtered = useMemo(() => {
    const visible = applyFilters(
      tasks.filter((t) => t.parentTaskId === null && t.status !== 'archived'),
      filters,
    );
    return [...visible].sort(SORTERS[filters.sort]);
  }, [tasks, filters]);

  // Active chips (only keys with values set)
  const activeChips = (Object.keys(FILTER_CHIP_LABELS) as (keyof TaskFilters)[]).filter((k) => {
    const v = filters[k];
    return Array.isArray(v) ? v.length > 0 : !!v && v !== 'priority' && v !== 'list';
  });
  const filterCount = countActiveFilters(filters);

  const overdueTasks = useMemo(() => getOverdueTasks(tasks), [tasks]);

  // Keyboard navigation — j/k move focus, x toggles selection, shift+j/k range-select
  const { focusedTaskId } = useTaskKeyboardNavigation(filtered, {
    onSelect: setSelectedTask,
    onSelectionToggle: toggleSelection,
  }, {
    enabled: !selectedTask && !deleteTarget,
  });

  // esc clears selection (only when something is selected, avoids conflicting with other esc handlers)
  useHotkey('escape', clearSelection, { enabled: selectedTaskIds.size > 0 });

  function renderRows(items: TaskTransport[]) {
    if (filters.view === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 py-3">
          {items.map((t) => (
            <DefaultTaskCard
              key={t.id}
              task={t}
              systemId={t.systemId}
              isFocused={t.id === focusedTaskId}
              onToggle={(id) => toggleTask({ taskId: id })}
              onDelete={() => setDeleteTarget(t)}
              onEdit={setSelectedTask}
              isSelected={selectedTaskIds.has(t.id)}
              onSelectionToggle={toggleSelection}
            />
          ))}
        </div>
      );
    }
    return (
      <div className="divide-y divide-border/50">
        {items.map((t) => (
          <TaskListRow
            key={t.id}
            task={t}
            systemMap={systemMap}
            isFocused={t.id === focusedTaskId}
            onToggle={(id) => toggleTask({ taskId: id })}
            onOpen={setSelectedTask}
            isSelected={selectedTaskIds.has(t.id)}
            onSelectionToggle={toggleSelection}
          />
        ))}
      </div>
    );
  }

  function renderGrouped(items: TaskTransport[]) {
    if (!filters.group) return renderRows(items);
    const grouped = groupTasks(items, filters.group);
    const keys = [...grouped.keys()].sort(
      (a, b) => (GROUP_ORDER[a] ?? 99) - (GROUP_ORDER[b] ?? 99),
    );
    return (
      <div className="space-y-1">
        {keys.map((key) => {
          const groupItems = grouped.get(key) ?? [];
          const groupName = filters.group === 'system'
            ? (systemMap.get(key)?.name ?? key)
            : key;
          return (
            <div key={key}>
              <div className="px-4 py-1.5 bg-muted/30 sticky top-0 z-10">
                <span className="text-xs font-semibold text-muted-foreground">{groupName}</span>
                <span className="ml-2 text-xs text-muted-foreground/50">{groupItems.length}</span>
              </div>
              {renderRows(groupItems)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Todas las tareas</span>
            <span className="text-xs text-muted-foreground">
              {filtered.length}
              {filterCount > 0 && ` · ${filterCount} filtro${filterCount > 1 ? 's' : ''}`}
            </span>
            {selectedTaskIds.size > 0 && (
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {selectedTaskIds.size} seleccionada{selectedTaskIds.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors',
                showFilters
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent/50',
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros
              {filterCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                  {filterCount}
                </span>
              )}
            </button>

            {/* View toggle */}
            <div className="flex rounded-md border overflow-hidden">
              {(['list', 'grid'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => handleViewToggle(v)}
                  className={cn(
                    'px-2 py-1 text-xs transition-colors',
                    filters.view === v
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent/50',
                  )}
                  title={v === 'list' ? 'Vista lista' : 'Vista grid'}
                >
                  {v === 'list' ? <LayoutList className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter chips */}
        {activeChips.length > 0 && (
          <div className="px-4 py-2 border-b flex flex-wrap gap-1.5">
            {activeChips.map((key) => (
              <span
                key={key}
                className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
              >
                {FILTER_CHIP_LABELS[key]}
                <button onClick={() => removeFilterChip(key)} className="hover:text-primary/70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Filter panel */}
        {showFilters && (
          <div className="p-4 border-b">
            <TaskFilterPanel filters={filters} systems={systems} onChange={handleFiltersChange} />
          </div>
        )}

        {/* Overdue group — KIN-29, 30, 31 */}
        {selectedTaskIds.size === 0 && (
          <OverdueGroup
            tasks={overdueTasks}
            systemMap={systemMap}
            onOpen={setSelectedTask}
            onToggle={(id) => toggleTask({ taskId: id })}
          />
        )}

        {/* Bulk action bar */}
        <BulkActionBar
          selectedIds={selectedTaskIds}
          onClear={clearSelection}
          onVaciar={selectedTaskIds.size > 0 ? () => setCascadeOpen(true) : undefined}
        />

        {/* TaskTransport list */}
        {isLoading ? (
          <div className="px-4 py-3 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 rounded bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {filterCount > 0 ? 'No hay tareas con esos filtros.' : 'Aún no tienes tareas.'}
            </p>
            {filterCount > 0 ? (
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                onClick={() => handleFiltersChange({
                  ...DEFAULT_FILTERS,
                  sort: filters.sort,
                  view: filters.view,
                })}
              >
                Limpiar filtros
              </Button>
            ) : (
              <Button size="sm" className="mt-3" onClick={() => setQuickAddOpen(true)}>
                <Plus className="size-4" />
                Crear tarea
              </Button>
            )}
          </div>
        ) : (
          renderGrouped(filtered)
        )}
      </div>

      {selectedTask && (
        <TaskDetailSheet
          task={selectedTask}
          systemId={selectedTask.systemId}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        />
      )}

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
