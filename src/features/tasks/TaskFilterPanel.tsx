'use client';

import type { TaskFilters } from '@/lib/taskFilters';
import { Fichas } from './Fichas';
import { PRIORITY_WORD, ENERGY_WORD } from './task-vocab';

interface SystemOption {
  id: string;
  name: string;
}

interface TaskFilterPanelProps {
  filters: TaskFilters;
  systems: SystemOption[];
  onChange: (next: TaskFilters) => void;
}

function toggle<T extends string>(arr: readonly T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'today', label: 'Hoy' },
  { value: 'tomorrow', label: 'Mañana' },
  { value: 'week', label: 'Esta semana' },
  { value: 'done', label: 'Hechas' },
];

export const PRIORITY_OPTIONS = (['critical', 'high', 'medium', 'low'] as const).map((value) => ({ value, label: PRIORITY_WORD[value]! }));

export const ENERGY_OPTIONS = (['high', 'medium', 'low'] as const).map((value) => ({ value, label: ENERGY_WORD[value]! }));

/**
 * Los tipos de verdad (`shared/types/enums.ts`): antes la hoja ofrecía `todo` y
 * `project`, que ninguna tarea tiene, y le faltaban Evento y Épica.
 */
export const TYPE_OPTIONS = [
  { value: 'task', label: 'Tarea' },
  { value: 'idea', label: 'Idea' },
  { value: 'event', label: 'Evento' },
  { value: 'reminder', label: 'Recordatorio' },
  { value: 'epic', label: 'Épica' },
] as const;

export const DATE_OPTIONS = [
  { value: 'overdue', label: 'Vencidas' },
  { value: 'no-date', label: 'Sin fecha' },
  { value: 'has-date', label: 'Con fecha' },
  { value: 'next7', label: 'Próximos 7 días' },
] as const;

export const GROUP_OPTIONS = [
  { value: 'system', label: 'Sistema' },
  { value: 'status', label: 'Estado' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'energy', label: 'Energía' },
] as const;

export const SORT_OPTIONS = [
  { value: 'priority', label: 'Prioridad' },
  { value: 'dueDate', label: 'Fecha límite' },
  { value: 'energy', label: 'Energía' },
  { value: 'created', label: 'Creación' },
] as const;

/**
 * Los filtros de /tasks como grupos de fichas con nombre: varios valores en
 * estado, sistema, prioridad, energía y tipo; uno solo en fecha, orden y
 * agrupar. Cada toque filtra al momento; la hoja que los contiene dice cuántas
 * tareas quedan.
 */
export function TaskFilterPanel({ filters, systems, onChange }: TaskFilterPanelProps) {
  const set = <K extends keyof TaskFilters>(key: K, val: TaskFilters[K]) =>
    onChange({ ...filters, [key]: val });

  const systemOptions = systems.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="space-y-5">
      <Fichas rotulo label="Estado" options={STATUS_OPTIONS} selected={filters.status} onToggle={(v) => set('status', toggle(filters.status, v))} />
      {systemOptions.length > 0 && (
        <Fichas rotulo label="Sistema" options={systemOptions} selected={filters.system} onToggle={(v) => set('system', toggle(filters.system, v))} />
      )}
      <Fichas rotulo label="Prioridad" options={PRIORITY_OPTIONS} selected={filters.priority} onToggle={(v) => set('priority', toggle(filters.priority, v))} />
      <Fichas rotulo label="Energía" options={ENERGY_OPTIONS} selected={filters.energy} onToggle={(v) => set('energy', toggle(filters.energy, v))} />
      <Fichas rotulo label="Tipo" options={TYPE_OPTIONS} selected={filters.type} onToggle={(v) => set('type', toggle(filters.type, v))} />
      <Fichas
        rotulo
        label="Fecha"
        options={DATE_OPTIONS}
        selected={filters.dateRange ? [filters.dateRange] : []}
        onToggle={(v) => set('dateRange', filters.dateRange === v ? '' : v)}
      />
      <Fichas rotulo label="Ordenar por" options={SORT_OPTIONS} selected={[filters.sort]} onToggle={(v) => set('sort', v)} />
      <Fichas
        rotulo
        label="Agrupar por"
        options={GROUP_OPTIONS}
        selected={filters.group ? [filters.group] : []}
        onToggle={(v) => set('group', filters.group === v ? '' : v)}
      />
    </div>
  );
}
