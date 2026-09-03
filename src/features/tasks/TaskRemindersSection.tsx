'use client';

import { useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Bot, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { TaskTransport } from './tasks.types';
import { parseDueDate } from './tasks.utils';
import { useTaskReminders, useCreateTaskReminder, useDeleteTaskReminder } from './tasks.hooks';

interface Props {
  task: TaskTransport;
}

const PRESETS = [
  { label: '1 día antes', days: 1 },
  { label: '2 días antes', days: 2 },
  { label: '3 días antes', days: 3 },
  { label: '1 semana antes', days: 7 },
];

export function TaskRemindersSection({ task }: Props) {
  const { data: reminders = [], isLoading } = useTaskReminders(task.id);
  const { mutate: createReminder, isPending: isCreating } = useCreateTaskReminder(task.id);
  const { mutate: deleteReminder } = useDeleteTaskReminder(task.id);

  const [open, setOpen] = useState(false);
  const [customDatetime, setCustomDatetime] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  function handlePreset(days: number, label: string) {
    if (!task.dueDate) return;
    const remindAt = subDays(parseDueDate(task.dueDate), days);
    remindAt.setUTCHours(9, 0, 0, 0);
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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Plus size={12} />
              Agregar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 space-y-3" align="end">
            {task.dueDate && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Relativo al vencimiento</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS.map(({ label, days }) => (
                    <Button
                      key={days}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={isCreating}
                      onClick={() => handlePreset(days, label)}
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

      {isLoading && (
        <p className="text-xs text-muted-foreground">Cargando...</p>
      )}

      {!isLoading && reminders.length === 0 && (
        <p className="text-xs text-muted-foreground">Sin recordatorios</p>
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
