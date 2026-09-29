'use client';

import { useState } from 'react';
import { format, parseISO, subDays, subHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Bot, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TaskTransport } from './tasks.types';
import { parseDueDate } from './tasks.utils';
import { hasDueTime } from './task-detail.helpers';
import { useTaskReminders, useCreateTaskReminder, useDeleteTaskReminder, useUpdateTask } from './tasks.hooks';

interface Props {
  task: TaskTransport;
}

type Intensidad = NonNullable<TaskTransport['reminderIntensity']>;

/** `cuenta` es no elegir: la tarea usa la intensidad de Ajustes. */
const INTENSIDADES: Array<{ value: Intensidad | 'cuenta'; label: string }> = [
  { value: 'cuenta', label: 'Como en Ajustes' },
  { value: 'aggressive', label: 'Agresivos' },
  { value: 'medium', label: 'Medios' },
  { value: 'low', label: 'Bajos' },
  { value: 'off', label: 'Sin avisos' },
];

/**
 * Los atajos dependen de si la tarea tiene hora. Con hora, lo útil es «una
 * hora antes»; sin hora, días antes a las 9 de la mañana **local**. Antes eran
 * las 9 UTC, que en América son las 4 o las 5 de la madrugada.
 */
function presetsDe(due: Date): Array<{ label: string; remindAt: Date }> {
  const aLasNueve = (d: Date) => {
    const out = new Date(d);
    out.setHours(9, 0, 0, 0);
    return out;
  };
  if (hasDueTime(due)) {
    return [
      { label: '1 h antes', remindAt: subHours(due, 1) },
      { label: '3 h antes', remindAt: subHours(due, 3) },
      { label: '1 día antes', remindAt: subDays(due, 1) },
      { label: '3 días antes', remindAt: subDays(due, 3) },
    ];
  }
  return [
    { label: 'El mismo día', remindAt: aLasNueve(due) },
    { label: '1 día antes', remindAt: aLasNueve(subDays(due, 1)) },
    { label: '3 días antes', remindAt: aLasNueve(subDays(due, 3)) },
    { label: '1 semana antes', remindAt: aLasNueve(subDays(due, 7)) },
  ];
}

export function TaskRemindersSection({ task }: Props) {
  const { data: reminders = [], isLoading } = useTaskReminders(task.id);
  const { mutate: createReminder, isPending: isCreating } = useCreateTaskReminder(task.id);
  const { mutate: deleteReminder } = useDeleteTaskReminder(task.id);
  const { mutate: updateTask, isPending: isSaving } = useUpdateTask(task.systemId);

  const [open, setOpen] = useState(false);
  const [customDatetime, setCustomDatetime] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  // La hora de abrir el menú, no la del render: los atajos ya pasados no se
  // ofrecen, y leer el reloj en un handler mantiene el render puro.
  const [abiertoEn, setAbiertoEn] = useState(0);
  const due = task.dueDate ? parseDueDate(task.dueDate) : null;
  const presets = due ? presetsDe(due).filter((p) => p.remindAt.getTime() > abiertoEn) : [];

  function handlePreset(remindAt: Date, label: string) {
    createReminder({ remindAt: remindAt.toISOString(), label }, { onSuccess: () => setOpen(false) });
  }

  function handleCustom() {
    if (!customDatetime) return;
    createReminder(
      {
        remindAt: new Date(customDatetime).toISOString(),
        label: customLabel || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setCustomDatetime('');
          setCustomLabel('');
        },
      },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Recordatorios</Label>
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (next) setAbiertoEn(Date.now());
            setOpen(next);
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Plus size={12} />
              Agregar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 space-y-3" align="end">
            {presets.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Relativo al vencimiento</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {presets.map(({ label, remindAt }) => (
                    <Button
                      key={label}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={isCreating}
                      onClick={() => handlePreset(remindAt, label)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Fecha y hora exacta</p>
              <Input
                type="datetime-local"
                className="h-8 text-xs"
                value={customDatetime}
                onChange={(e) => setCustomDatetime(e.target.value)}
              />
              <Input
                type="text"
                placeholder="Etiqueta (opcional)"
                className="h-8 text-xs"
                maxLength={255}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                disabled={!customDatetime || isCreating}
                onClick={handleCustom}
              >
                Guardar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {task.dueDate && (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-medium">Cuánto insiste</p>
            <p className="text-xs text-muted-foreground">
              {task.nextReminderAt
                ? `Próximo aviso: ${format(parseISO(task.nextReminderAt), "EEEE d, HH:mm", { locale: es })}`
                : task.status === 'done'
                  ? 'Terminada: ya no avisa.'
                  : 'Sin avisos pendientes. El resumen de la mañana la sigue trayendo.'}
            </p>
          </div>
          <Select
            value={task.reminderIntensity ?? 'cuenta'}
            disabled={isSaving}
            onValueChange={(value) =>
              updateTask({ taskId: task.id, data: { reminderIntensity: value === 'cuenta' ? null : (value as Intensidad) } })
            }
          >
            <SelectTrigger className="h-8 w-[150px] shrink-0 text-xs" aria-label="Cuánto insiste esta tarea">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTENSIDADES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading && (
        <p className="text-xs text-muted-foreground">Cargando...</p>
      )}

      {!isLoading && reminders.length === 0 && (
        <p className="text-xs text-muted-foreground">Sin recordatorios a mano</p>
      )}

      <ul className="space-y-1.5">
        {reminders.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            {r.source === 'auto' ? (
              <Bot size={13} className="text-muted-foreground shrink-0" />
            ) : (
              <Bell size={13} className="text-muted-foreground shrink-0" />
            )}
            <span className="flex-1 min-w-0 truncate">
              {r.label ?? 'Recordatorio'}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {format(parseISO(r.remindAt), "d MMM, HH:mm", { locale: es })}
              </span>
            </span>
            {r.sentAt ? (
              <X size={12} className="text-muted-foreground shrink-0" aria-label="Ya enviado" />
            ) : r.source === 'user' ? (
              <button
                onClick={() => deleteReminder(r.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Eliminar recordatorio"
              >
                <Trash2 size={13} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
