'use client';

import { useState } from 'react';
import { format, parseISO, subDays, subHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Bot, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TaskTransport } from './tasks.types';
import { Fichas } from './Fichas';
import { CampoFlotante, DetailRow, VALOR_TOCABLE } from './TaskDetailFields';
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
    <>
      <DetailRow label="Avisos" id="avisos-rotulo">
        <div className="space-y-1 py-0.5">
          {isLoading && <p className="pt-[0.6rem] text-sm text-muted-foreground">Leyendo los avisos</p>}
          {!isLoading && reminders.length === 0 && (
            <p className="pt-[0.6rem] text-base text-muted-foreground">Sin avisos puestos a mano</p>
          )}
          {reminders.length > 0 && (
            <ul>
              {reminders.map((r) => (
                <li key={r.id} className="flex min-h-[2.85rem] items-center gap-2 text-base">
                  {r.source === 'auto' ? (
                    <Bot className="size-4 shrink-0 text-muted-foreground" aria-label="Automático" />
                  ) : (
                    <Bell className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {r.label ?? 'Aviso'}
                    <span className="ml-1.5 text-sm text-muted-foreground tabular-nums">
                      {format(parseISO(r.remindAt), "d MMM, HH:mm", { locale: es }).replace('.', '')}
                    </span>
                  </span>
                  {r.sentAt ? (
                    <X className="size-4 shrink-0 text-muted-foreground" aria-label="Ya enviado" />
                  ) : r.source === 'user' ? (
                    <button
                      type="button"
                      onClick={() => deleteReminder(r.id)}
                      className="focus-ring -mr-2 flex size-[2.85rem] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:text-destructive md:pointer-fine:size-8"
                      aria-label="Quitar el aviso"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <CampoFlotante
            titulo="Agregar un aviso"
            descripcion={presets.length > 0 ? 'Relativo al vencimiento, o a una fecha exacta.' : 'A una fecha y hora exactas.'}
            open={open}
            onOpenChange={(next) => {
              if (next) setAbiertoEn(Date.now());
              setOpen(next);
            }}
            disparador={(props) => (
              <button type="button" className={`${VALOR_TOCABLE} gap-1.5 text-muted-foreground`} {...props}>
                <Plus className="size-4" />
                Agregar un aviso
              </button>
            )}
          >
            <div className="w-full space-y-4 md:w-64">
              {presets.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">Relativo al vencimiento</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {presets.map(({ label, remindAt }) => (
                      <Button key={label} variant="secondary" size="sm" disabled={isCreating} onClick={() => handlePreset(remindAt, label)}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">Fecha y hora exactas</p>
                <Input
                  type="datetime-local"
                  aria-label="Fecha y hora del aviso"
                  className="h-[2.85rem] md:pointer-fine:h-9 dark:[color-scheme:dark]"
                  value={customDatetime}
                  onChange={(e) => setCustomDatetime(e.target.value)}
                />
                <Input
                  type="text"
                  aria-label="Etiqueta del aviso"
                  placeholder="Etiqueta (opcional)"
                  className="h-[2.85rem] md:pointer-fine:h-9"
                  maxLength={255}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                />
                <Button className="w-full" disabled={!customDatetime || isCreating} onClick={handleCustom}>
                  Guardar el aviso
                </Button>
              </div>
            </div>
          </CampoFlotante>
        </div>
      </DetailRow>

      {task.dueDate && (
        <DetailRow label="Insiste" id="insiste-rotulo">
          <div className="space-y-1.5 py-1">
            <Fichas
              label="Cuánto insiste esta tarea"
              labelledBy="insiste-rotulo"
              options={INTENSIDADES}
              selected={[task.reminderIntensity ?? 'cuenta']}
              onToggle={(value) => {
                if (isSaving) return;
                updateTask({ taskId: task.id, data: { reminderIntensity: value === 'cuenta' ? null : (value as Intensidad) } });
              }}
            />
            <p className="text-sm text-muted-foreground">
              {task.nextReminderAt
                ? `Próximo aviso: ${format(parseISO(task.nextReminderAt), "EEEE d, HH:mm", { locale: es })}`
                : task.status === 'done'
                  ? 'Terminada: ya no avisa.'
                  : 'Sin avisos pendientes. El resumen de la mañana la sigue trayendo.'}
            </p>
          </div>
        </DetailRow>
      )}
    </>
  );
}
