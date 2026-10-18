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

/**
 * Una ficha de filtro: 48 px de alto en el teléfono (el táctil mínimo) y 2rem
 * con ratón. Elegida va en tinta, como el segmento: filtrar es un estado, no
 * una acción, y el ámbar es de la acción.
 */
const PILL =
  'press focus-ring inline-flex h-[2.85rem] items-center rounded-full border px-3.5 text-sm font-medium transition-[color,background-color,border-color,transform] duration-(--dur-toque) ease-(--ease-pluma) md:pointer-fine:h-8 md:pointer-fine:px-3 md:pointer-fine:text-xs';
const PILL_ON = 'border-foreground bg-foreground text-background';
const PILL_OFF = 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground';

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
      <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(({ value, label: l }) => (
          <button
            key={value}
            type="button"
            aria-pressed={selected.includes(value)}
            onClick={() => onToggle(value)}
            className={cn(
              PILL,
              selected.includes(value)
                ? PILL_ON
                : PILL_OFF,
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
  { value: 'week', label: 'Esta semana' },
  { value: 'done', label: 'Hechas' },
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
    <div className="space-y-5">
      <PillGroup label="Estado" options={STATUS_OPTIONS} selected={filters.status} onToggle={(v) => set('status', toggle(filters.status, v))} />
      {systemOptions.length > 0 && (
        <PillGroup label="Sistema" options={systemOptions} selected={filters.system} onToggle={(v) => set('system', toggle(filters.system, v))} />
      )}
      <PillGroup label="Prioridad" options={PRIORITY_OPTIONS} selected={filters.priority} onToggle={(v) => set('priority', toggle(filters.priority, v))} />
      <PillGroup label="Energía" options={ENERGY_OPTIONS} selected={filters.energy} onToggle={(v) => set('energy', toggle(filters.energy, v))} />
      <PillGroup label="Tipo" options={TYPE_OPTIONS} selected={filters.type} onToggle={(v) => set('type', toggle(filters.type, v))} />

      {/* Fecha: single select */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Fecha</p>
        <div className="flex flex-wrap gap-1.5">
          {DATE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.dateRange === value}
              onClick={() => set('dateRange', filters.dateRange === value ? '' : value)}
              className={cn(
                PILL,
                filters.dateRange === value
                  ? PILL_ON
                  : PILL_OFF,
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ordenar */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Ordenar por</p>
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.sort === value}
              onClick={() => set('sort', value)}
              className={cn(
                PILL,
                filters.sort === value
                  ? PILL_ON
                  : PILL_OFF,
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Agrupar */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Agrupar por</p>
        <div className="flex flex-wrap gap-1.5">
          {GROUP_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.group === value}
              onClick={() => set('group', filters.group === value ? '' : value)}
              className={cn(
                PILL,
                filters.group === value
                  ? PILL_ON
                  : PILL_OFF,
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
