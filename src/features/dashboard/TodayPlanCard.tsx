import { Zap, ArrowRight, Clock, AlertCircle, Coffee, Flame, Minus, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Task } from '@/features/tasks/tasks.types';
import type { EnergyPlanItem } from '@/features/energy/energy.planner';

interface TodayPlanCardProps {
  pendingTasks: Task[];
  doneCount: number;
  totalToday: number;
  noProfile: boolean;
  energyItems?: EnergyPlanItem[];
}

const ENERGY_PILL: Record<string, string> = {
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  medium: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  low: 'bg-zinc-500/15 text-zinc-400',
};

const ENERGY_LABEL: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

function estimatedLabel(estimatedTime: string | null | undefined): string {
  if (!estimatedTime) return '';
  const parts = estimatedTime.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
}

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === 'critical') return <Flame size={12} className="text-red-400 shrink-0" />;
  if (priority === 'high') return <Zap size={12} className="text-orange-400 shrink-0" />;
  return <Minus size={12} className="text-zinc-400 shrink-0" />;
}

function EnergyDot({ level }: { level: string }) {
  return (
    <span className={cn(
      'inline-flex size-1.5 rounded-full shrink-0',
      level === 'high' ? 'bg-amber-400' : level === 'medium' ? 'bg-sky-400' : 'bg-zinc-500',
    )} />
  );
}

function EnergyRow({ item, isFirst }: { item: EnergyPlanItem; isFirst: boolean }) {
  const dur = estimatedLabel(item.task.estimatedTime);
  return (
    <>
      {item.breakBefore && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 text-xs text-muted-foreground">
          <Coffee className="w-3 h-3 shrink-0" />
          <span>Descanso recomendado</span>
        </div>
      )}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 group',
        isFirst && 'bg-emerald-500/5',
      )}>
        <div className="shrink-0">
          {isFirst
            ? <Zap className="w-3.5 h-3.5 text-emerald-500" />
            : <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30" />}
        </div>
        <div className="flex-1 min-w-0">
          {isFirst && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500 mb-0.5">
              Empieza aquí
            </p>
          )}
          <p className="text-sm font-medium truncate">{item.task.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', ENERGY_PILL[item.task.energyLevel] ?? ENERGY_PILL.medium)}>
            {ENERGY_LABEL[item.task.energyLevel] ?? item.task.energyLevel}
          </span>
          {dur && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {dur}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function PriorityRow({ task, isFirst }: { task: Task; isFirst: boolean }) {
  const dur = estimatedLabel(task.estimatedTime);
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3',
      isFirst && 'bg-emerald-500/5',
    )}>
      <PriorityIcon priority={task.priority} />
      <div className="flex-1 min-w-0">
        {isFirst && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500 mb-0.5">
            Empieza aquí
          </p>
        )}
        <p className="text-sm font-medium truncate">{task.title}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <EnergyDot level={task.energyLevel} />
        {dur && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {dur}
          </span>
        )}
      </div>
    </div>
  );
}

export function TodayPlanCard({ pendingTasks, doneCount, totalToday, noProfile, energyItems }: TodayPlanCardProps) {
  const useEnergyPlan = energyItems !== undefined && energyItems.length > 0;
  const progressPct = totalToday > 0 ? Math.round((doneCount / totalToday) * 100) : 0;
  const allDone = pendingTasks.length === 0 && doneCount > 0;
  const isEmpty = pendingTasks.length === 0 && doneCount === 0 && !useEnergyPlan;

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-sm">Plan de hoy</h2>
          {totalToday > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {doneCount} de {totalToday} completada{totalToday !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {totalToday > 0 && (
          <span className="text-xs font-mono font-medium text-muted-foreground tabular-nums">
            {progressPct}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalToday > 0 && (
        <div className="h-1 w-full bg-muted shrink-0">
          <div
            className="h-full bg-emerald-500 motion-safe:transition-all motion-safe:duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {noProfile && (
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Perfil de energía no configurado</p>
              <p className="text-xs text-muted-foreground">
                Kino necesita tu perfil para proponer un plan.
              </p>
              <Link href="/onboarding" className="text-xs text-primary hover:underline">
                Configurar perfil →
              </Link>
            </div>
          </div>
        )}

        {!noProfile && allDone && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-500">¡Todo listo por hoy!</p>
            <p className="text-xs text-muted-foreground">
              {doneCount} tarea{doneCount !== 1 ? 's' : ''} completada{doneCount !== 1 ? 's' : ''}.
            </p>
          </div>
        )}

        {!noProfile && isEmpty && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
            <p className="text-sm text-muted-foreground">
              No hay tareas para hoy.{' '}
              <Link href="/systems" className="underline underline-offset-2 hover:text-foreground">
                Abre un sistema
              </Link>{' '}
              o presiona{' '}
              <kbd className="font-sans px-1.5 py-0.5 border rounded text-xs">⌘+K</kbd> para ir al Inbox.
            </p>
          </div>
        )}

        {!noProfile && !allDone && !isEmpty && (
          <div className="divide-y">
            {useEnergyPlan
              ? energyItems!.map((item, i) => (
                  <EnergyRow key={item.task.id} item={item} isFirst={i === 0} />
                ))
              : pendingTasks.map((task, i) => (
                  <PriorityRow key={task.id} task={task} isFirst={i === 0} />
                ))}

            {doneCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 opacity-40">
                <span className="size-2.5 rounded-full bg-emerald-500/50 border border-emerald-500/70 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {doneCount} tarea{doneCount !== 1 ? 's' : ''} completada{doneCount !== 1 ? 's' : ''} hoy
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
