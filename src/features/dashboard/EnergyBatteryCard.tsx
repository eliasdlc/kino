'use client';

import { useState } from 'react';
import { Battery, Moon, Clock } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  ReferenceLine,
  ReferenceArea,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useTodayCheckins, useCreateCheckin, useUpdateCheckinAccuracy } from '@/features/energy/energy.hooks';
import type { CheckinSlot } from '@/features/energy/energy.schemas';
import type { Chronotype } from '@/features/energy/energy.utils';
import type { EnergyPlanItem } from '@/features/energy/energy.planner';
import type { Task } from '@/features/tasks/tasks.types';
import type { TodayCheckinRow } from '@/features/energy/energy.service';

interface EnergyBatteryCardProps {
  initialCheckins: TodayCheckinRow[];
  projectedCurve: readonly number[] | null;
  chronotype: Chronotype | null;
  scheduledItems?: EnergyPlanItem[];
  deferredTasks?: Task[];
}

const SLEEP_LABELS: Record<string, string> = {
  good: 'Bien',
  partial: 'Regular',
  poor: 'Mal',
};

const SLEEP_COLORS: Record<string, string> = {
  good: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  partial: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30',
  poor: 'bg-red-500/15 text-red-500 dark:text-red-400 ring-red-500/30',
};

const SLOT_LABELS: Record<CheckinSlot, string> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche',
};

const SLOT_HOURS: Record<CheckinSlot, [number, number]> = {
  morning: [6, 12],
  afternoon: [12, 18],
  evening: [18, 24],
};

const PEAK_WINDOWS: Record<Chronotype, [number, number]> = {
  morning: [8, 11],
  intermediate: [10, 13],
  evening: [15, 21],
};

function getCurrentSlot(): CheckinSlot {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

function levelColor(level: number): string {
  if (level >= 70) return 'text-emerald-500';
  if (level >= 40) return 'text-amber-400';
  return 'text-red-400';
}

interface ChartEntry {
  hour: number;
  predicted: number | null;
  actual: number | null;
}

function buildChartData(
  projectedCurve: readonly number[],
  checkins: TodayCheckinRow[],
): ChartEntry[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const checkin = checkins.find((c) => new Date(c.createdAt).getHours() === hour);
    return {
      hour,
      predicted: Math.round(projectedCurve[hour] ?? 0),
      actual: checkin ? checkin.currentLevel : null,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EnergyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const predicted = payload.find((p: { dataKey: string }) => p.dataKey === 'predicted')?.value as number | undefined;
  const actual = payload.find((p: { dataKey: string }) => p.dataKey === 'actual')?.value as number | undefined;
  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow">
      <p className="text-muted-foreground mb-0.5">{label}h</p>
      {predicted != null && <p>Predicho: <span className="font-medium">{predicted}</span></p>}
      {actual != null && <p>Registrado: <span className="font-medium text-amber-400">{actual}</span></p>}
    </div>
  );
}

export function EnergyBatteryCard({
  initialCheckins,
  projectedCurve,
  chronotype,
  scheduledItems = [],
  deferredTasks = [],
}: EnergyBatteryCardProps) {
  const { data: liveCheckins } = useTodayCheckins();
  const { mutate: createCheckin, isPending } = useCreateCheckin();
  const { mutate: updateAccuracy, isPending: isUpdatingAccuracy } = useUpdateCheckinAccuracy();

  const checkins = liveCheckins ?? initialCheckins;
  const currentSlot = getCurrentSlot();
  const currentHour = new Date().getHours();

  const [selectedSlot, setSelectedSlot] = useState<CheckinSlot>(currentSlot);
  const [showForm, setShowForm] = useState(false);
  const [level, setLevel] = useState(70);
  const [sleep, setSleep] = useState<'good' | 'partial' | 'poor'>('good');

  const slotCheckin = checkins.find((c) => c.slot === selectedSlot) ?? null;
  const currentSlotCheckin = checkins.find((c) => c.slot === currentSlot) ?? null;
  const peakWindow = chronotype ? PEAK_WINDOWS[chronotype] : null;

  const chartData = projectedCurve ? buildChartData(projectedCurve, checkins) : null;

  function handleSubmit() {
    createCheckin(
      { currentLevel: level, sleepQuality: sleep, slot: selectedSlot },
      { onSuccess: () => setShowForm(false) },
    );
  }

  function handleAccuracy(accuracy: 'accurate' | 'partial' | 'inaccurate') {
    updateAccuracy({ accuracy, slot: currentSlot });
  }

  const hasAnyCheckin = checkins.length > 0;
  const showPredictionFeedback =
    currentSlotCheckin !== null && currentSlotCheckin.predictionAccuracy === null && projectedCurve !== null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4 text-muted-foreground" />
          <p className="font-semibold text-sm">Energía de hoy</p>
          {chronotype && (
            <span className="text-xs text-muted-foreground capitalize">· {chronotype}</span>
          )}
        </div>
        {hasAnyCheckin && !showForm && (
          <button
            onClick={() => { setSelectedSlot(currentSlot); setShowForm(true); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Actualizar
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Gráfica Recharts */}
        {chartData && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {hasAnyCheckin ? 'Predicción · checkins de hoy' : 'Capacidad proyectada'}
            </p>
            <ResponsiveContainer width="100%" height={72}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="hour" hide />
                <YAxis domain={[0, 100]} hide />
                {peakWindow && (
                  <ReferenceArea
                    x1={peakWindow[0]}
                    x2={peakWindow[1]}
                    fill="#fbbf24"
                    fillOpacity={0.08}
                  />
                )}
                <Bar dataKey="predicted" fill="#94a3b8" opacity={0.35} barSize={5} radius={[2, 2, 0, 0]} />
                <Line
                  dataKey="actual"
                  stroke="transparent"
                  dot={(props) => {
                    const { cx, cy, value } = props as { cx: number; cy: number; value: number | null };
                    if (value == null) return <g key={`dot-${cx}`} />;
                    return (
                      <circle
                        key={`dot-${cx}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="#fbbf24"
                        stroke="#1c1917"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <ReferenceLine
                  x={currentHour}
                  stroke="rgba(255,255,255,0.5)"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                />
                <Tooltip content={<EnergyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-[10px] text-muted-foreground/50">
              <span>0h</span>
              <span>12h</span>
              <span>23h</span>
            </div>
          </div>
        )}

        {/* Selector de slots */}
        {!showForm && (
          <div className="flex gap-1.5">
            {(Object.keys(SLOT_LABELS) as CheckinSlot[]).map((slot) => {
              const hasCheckin = checkins.some((c) => c.slot === slot);
              const isActive = slot === currentSlot;
              return (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    'flex-1 text-xs py-1 rounded-md border transition-colors relative',
                    selectedSlot === slot
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent/50 text-muted-foreground',
                    isActive && selectedSlot !== slot && 'border-dashed',
                  )}
                >
                  {SLOT_LABELS[slot]}
                  {hasCheckin && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Estado del slot seleccionado */}
        {!showForm && slotCheckin && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {SLOT_LABELS[selectedSlot]} · nivel
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium ring-1',
                    SLEEP_COLORS[slotCheckin.sleepQuality] ?? SLEEP_COLORS.good,
                  )}
                >
                  <Moon className="inline w-3 h-3 mr-1" />
                  {SLEEP_LABELS[slotCheckin.sleepQuality] ?? slotCheckin.sleepQuality}
                </span>
                <span className={cn('text-lg font-bold tabular-nums', levelColor(slotCheckin.currentLevel))}>
                  {slotCheckin.currentLevel}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CTA: sin checkin del slot activo */}
        {!showForm && !currentSlotCheckin && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {hasAnyCheckin
                ? `Sin registro para la ${SLOT_LABELS[currentSlot].toLowerCase()} — registra cómo vas ahora.`
                : 'Registra tu energía para que Kino adapte el plan a tu estado real.'}
            </p>
            <Button size="sm" onClick={() => { setSelectedSlot(currentSlot); setShowForm(true); }}>
              Registrar energía · {SLOT_LABELS[currentSlot]}
            </Button>
          </div>
        )}

        {/* Feedback de predicción */}
        {!showForm && showPredictionFeedback && (
          <div className="space-y-1.5 pt-1 border-t">
            <p className="text-xs text-muted-foreground">¿La predicción está siendo correcta?</p>
            <div className="flex gap-2">
              {[
                { key: 'accurate' as const, label: '✓ Sí' },
                { key: 'partial' as const, label: '~ Más o menos' },
                { key: 'inaccurate' as const, label: '✗ No' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleAccuracy(key)}
                  disabled={isUpdatingAccuracy}
                  className="flex-1 text-xs py-1 rounded-md border border-border hover:bg-accent/50 text-muted-foreground transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formulario inline */}
        {showForm && (
          <div className="space-y-4">
            <div className="flex gap-1.5 mb-1">
              {(Object.keys(SLOT_LABELS) as CheckinSlot[]).map((slot) => {
                const [start, end] = SLOT_HOURS[slot];
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      'flex-1 text-xs py-1 rounded-md border transition-colors',
                      selectedSlot === slot
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent/50 text-muted-foreground',
                    )}
                  >
                    {SLOT_LABELS[slot]}
                    <span className="block text-[10px] opacity-60">{start}–{end}h</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">¿Cómo está tu energía? (1–100)</p>
                <span className={cn('text-sm font-bold tabular-nums', levelColor(level))}>
                  {level}
                </span>
              </div>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[level]}
                onValueChange={([v]) => v !== undefined && setLevel(v)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">¿Cómo dormiste?</p>
              <div className="flex gap-2">
                {(['good', 'partial', 'poor'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setSleep(q)}
                    className={cn(
                      'flex-1 text-xs py-1.5 rounded-md border font-medium transition-colors',
                      sleep === q
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent/50 text-muted-foreground',
                    )}
                  >
                    {SLEEP_LABELS[q]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-1">
                {isPending ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Tareas diferidas */}
        {deferredTasks.length > 0 && !showForm && (
          <div className="space-y-1.5 pt-1 border-t">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">Diferidas ({deferredTasks.length})</p>
            </div>
            {deferredTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                <span className="truncate">{task.title}</span>
              </div>
            ))}
            {deferredTasks.length > 3 && (
              <p className="text-xs text-muted-foreground/50">y {deferredTasks.length - 3} más</p>
            )}
          </div>
        )}

        {/* Task dots de scheduled items */}
        {scheduledItems.length > 0 && !showForm && !deferredTasks.length && (
          <div className="flex items-center gap-1 pt-1 border-t">
            <p className="text-xs text-muted-foreground">{scheduledItems.length} tareas planificadas</p>
          </div>
        )}
      </div>
    </div>
  );
}
