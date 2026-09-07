'use client';

import { cn } from '@/lib/utils';
import type { TaskFilters } from '@/lib/taskFilters';

interface SystemOption {
  id: string;
  name: string;
}

interface TaskFilterPanelProps {
  filters: TaskFilters;
  systems: SystemOption[];
  onChange: (next: TaskFilters) => void;
}

function toggle<T extends string>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

type PillGroupProps<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (val: T) => void;
};

function PillGroup<T extends string>({ label, options, selected, onToggle }: PillGroupProps<T>) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(({ value, label: l }) => (
          <button
            key={value}
            onClick={() => onToggle(value)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors',
              selected.includes(value)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent/50',
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'today', label: 'Hoy' },
  { value: 'tomorrow', label: 'Mañana' },
  { value: 'week', label: 'Semana' },
  { value: 'done', label: 'Hecho' },
];

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Crítica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

const ENERGY_OPTIONS = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

const TYPE_OPTIONS = [
  { value: 'todo', label: 'Tarea' },
  { value: 'idea', label: 'Idea' },
  { value: 'reminder', label: 'Recordatorio' },
  { value: 'project', label: 'Proyecto' },
];

const DATE_OPTIONS = [
  { value: 'overdue', label: 'Vencidas' },
  { value: 'no-date', label: 'Sin fecha' },
  { value: 'has-date', label: 'Con fecha' },
  { value: 'next7', label: 'Próximos 7 días' },
] as const;

const GROUP_OPTIONS = [
  { value: 'system', label: 'Sistema' },
  { value: 'status', label: 'Estado' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'energy', label: 'Energía' },
] as const;

const SORT_OPTIONS = [
  { value: 'priority', label: 'Prioridad' },
  { value: 'dueDate', label: 'Fecha límite' },
  { value: 'energy', label: 'Energía' },
  { value: 'created', label: 'Creación' },
] as const;

export function TaskFilterPanel({ filters, systems, onChange }: TaskFilterPanelProps) {
  const set = <K extends keyof TaskFilters>(key: K, val: TaskFilters[K]) =>
    onChange({ ...filters, [key]: val });

  const systemOptions = systems.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="border rounded-xl bg-card p-4 space-y-4">
      <PillGroup label="Estado" options={STATUS_OPTIONS} selected={filters.status} onToggle={(v) => set('status', toggle(filters.status, v))} />
      {systemOptions.length > 0 && (
        <PillGroup label="Sistema" options={systemOptions} selected={filters.system} onToggle={(v) => set('system', toggle(filters.system, v))} />
      )}
      <PillGroup label="Prioridad" options={PRIORITY_OPTIONS} selected={filters.priority} onToggle={(v) => set('priority', toggle(filters.priority, v))} />
      <PillGroup label="Energía" options={ENERGY_OPTIONS} selected={filters.energy} onToggle={(v) => set('energy', toggle(filters.energy, v))} />
      <PillGroup label="Tipo" options={TYPE_OPTIONS} selected={filters.type} onToggle={(v) => set('type', toggle(filters.type, v))} />

      {/* Fecha: single select */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Fecha</p>
        <div className="flex flex-wrap gap-1.5">
          {DATE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => set('dateRange', filters.dateRange === value ? '' : value)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                filters.dateRange === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent/50',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ordenar */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ordenar por</p>
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => set('sort', value)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                filters.sort === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent/50',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Agrupar */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Agrupar por</p>
        <div className="flex flex-wrap gap-1.5">
          {GROUP_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => set('group', filters.group === value ? '' : value)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                filters.group === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent/50',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
