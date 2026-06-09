import { differenceInCalendarDays, startOfToday } from 'date-fns';
import { parseDueDate } from '@/features/tasks/tasks.utils';
import type { Task } from '@/features/tasks/tasks.types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TaskFilters {
  status: string[];
  system: string[];
  priority: string[];
  energy: string[];
  type: string[];
  dateRange: '' | 'overdue' | 'no-date' | 'has-date' | 'next7';
  group: '' | 'system' | 'status' | 'priority' | 'energy';
  sort: 'priority' | 'dueDate' | 'energy' | 'created';
  view: 'list' | 'grid';
}

export const DEFAULT_FILTERS: TaskFilters = {
  status: [],
  system: [],
  priority: [],
  energy: [],
  type: [],
  dateRange: '',
  group: '',
  sort: 'priority',
  view: 'list',
};

// ── URL serialization ──────────────────────────────────────────────────────

const CSV_KEYS: (keyof TaskFilters)[] = ['status', 'system', 'priority', 'energy', 'type'];
const SCALAR_KEYS: (keyof TaskFilters)[] = ['dateRange', 'group', 'sort', 'view'];

export function parseFiltersFromParams(p: URLSearchParams): TaskFilters {
  const f = { ...DEFAULT_FILTERS };
  for (const key of CSV_KEYS) {
    const raw = p.get(key);
    if (raw) (f[key] as string[]) = raw.split(',').filter(Boolean);
  }
  for (const key of SCALAR_KEYS) {
    const raw = p.get(key);
    if (raw) (f[key] as string) = raw;
  }
  return f;
}

export function filtersToParams(f: TaskFilters): URLSearchParams {
  const p = new URLSearchParams();
  for (const key of CSV_KEYS) {
    const arr = f[key] as string[];
    if (arr.length) p.set(key, arr.join(','));
  }
  for (const key of SCALAR_KEYS) {
    const val = f[key] as string;
    const def = DEFAULT_FILTERS[key] as string;
    if (val && val !== def) p.set(key, val);
  }
  return p;
}

export function countActiveFilters(f: TaskFilters): number {
  return (
    f.status.length +
    f.system.length +
    f.priority.length +
    f.energy.length +
    f.type.length +
    (f.dateRange ? 1 : 0) +
    (f.group ? 1 : 0)
  );
}

// ── Filtering ──────────────────────────────────────────────────────────────

export function applyFilters(tasks: Task[], f: TaskFilters): Task[] {
  const today = startOfToday();
  return tasks.filter((t) => {
    if (f.status.length && !f.status.includes(t.status)) return false;
    if (f.system.length && !f.system.includes(t.systemId)) return false;
    if (f.priority.length && !f.priority.includes(t.priority ?? '')) return false;
    if (f.energy.length && !f.energy.includes(t.energyLevel ?? '')) return false;
    if (f.type.length && !f.type.includes(t.taskType ?? '')) return false;
    if (f.dateRange) {
      const due = t.dueDate ? parseDueDate(t.dueDate) : null;
      if (f.dateRange === 'no-date' && due !== null) return false;
      if (f.dateRange === 'has-date' && due === null) return false;
      if (f.dateRange === 'overdue') {
        if (!due || differenceInCalendarDays(due, today) >= 0) return false;
      }
      if (f.dateRange === 'next7') {
        if (!due) return false;
        const days = differenceInCalendarDays(due, today);
        if (days < 0 || days > 7) return false;
      }
    }
    return true;
  });
}

// ── Sorting ────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const ENERGY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const SORTERS: Record<TaskFilters['sort'], (a: Task, b: Task) => number> = {
  priority: (a, b) =>
    (PRIORITY_ORDER[a.priority ?? 'medium'] ?? 2) - (PRIORITY_ORDER[b.priority ?? 'medium'] ?? 2),
  dueDate: (a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  },
  energy: (a, b) =>
    (ENERGY_ORDER[a.energyLevel ?? 'medium'] ?? 1) - (ENERGY_ORDER[b.energyLevel ?? 'medium'] ?? 1),
  created: (a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
};

// ── Grouping ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog', week: 'Esta semana', today: 'Hoy', tomorrow: 'Mañana',
  done: 'Completadas', archived: 'Archivadas',
};
const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja',
};
const ENERGY_LABEL: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

export type GroupKey = Exclude<TaskFilters['group'], ''>;

export const GROUPERS: Record<GroupKey, (t: Task) => string> = {
  system: (t) => t.systemId,
  status: (t) => STATUS_LABEL[t.status] ?? t.status,
  priority: (t) => PRIORITY_LABEL[t.priority ?? 'medium'] ?? 'Media',
  energy: (t) => ENERGY_LABEL[t.energyLevel ?? 'medium'] ?? 'Media',
};

export function groupTasks(tasks: Task[], groupKey: GroupKey): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  const grouper = GROUPERS[groupKey];
  for (const task of tasks) {
    const key = grouper(task);
    const arr = map.get(key) ?? [];
    arr.push(task);
    map.set(key, arr);
  }
  return map;
}
