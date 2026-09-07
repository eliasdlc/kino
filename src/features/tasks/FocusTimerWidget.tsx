'use client';

import { useEffect, useReducer } from 'react';
import { Square, Timer, CheckCircle2, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTimer } from './FocusTimerProvider';

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MODE_LABELS = { pomodoro: 'Pomodoro', estimated: 'Estimado', free: 'Libre' } as const;

export function FocusTimerWidget() {
  const { state, dispatch, remainingMs, elapsedMs } = useFocusTimer();

  // Force re-render every second while timer is running
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'recap') return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  if (state.phase === 'idle' || state.phase === 'recap') return null;

  const isBreak = state.phase === 'break';
  const rem = remainingMs();
  const elapsed = elapsedMs();
  const isFree = state.mode === 'free';
  const isExpired = state.expired && !isBreak;

  const timeDisplay = isBreak
    ? rem !== null ? formatCountdown(rem) : '--:--'
    : isFree
    ? formatElapsed(elapsed)
    : rem !== null ? formatCountdown(rem) : '--:--';

  const stopAction = isBreak ? { type: 'END_BREAK' as const } : { type: 'STOP' as const };

  // Desktop floating card
  const desktopWidget = (
    <div
      className={cn(
        'hidden md:flex fixed bottom-4 right-4 z-(--z-modal)',
        'items-center gap-3 rounded-xl border bg-card shadow-lg px-4 py-3 max-w-xs',
        isBreak && 'border-blue-500/30 bg-blue-950/20',
        isExpired && 'border-amber-500/50',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 shrink-0',
          isBreak ? 'text-blue-400' : isExpired ? 'text-amber-400' : 'text-amber-500',
        )}
      >
        {isBreak ? (
          <Coffee className="size-4" />
        ) : (
          <Timer className={cn('size-4', !isExpired && !isFree && 'animate-pulse')} />
        )}
        <span className="text-sm font-bold tabular-nums">
          {isExpired ? 'Tiempo agotado' : timeDisplay}
        </span>
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">
          {isBreak ? 'Descanso' : state.taskTitle}
        </p>
        {state.mode && !isBreak && (
          <p className="text-[10px] text-muted-foreground">{MODE_LABELS[state.mode]}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!isBreak && !state.pageId && (
          <button
            onClick={() => dispatch({ type: 'COMPLETE_TASK' })}
            className="p-1.5 rounded-md text-muted-foreground hover:text-green-400 hover:bg-green-400/10 transition-colors"
            aria-label="Completar tarea"
          >
            <CheckCircle2 className="size-3.5" />
          </button>
        )}
        <button
          onClick={() => dispatch(stopAction)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={isBreak ? 'Saltar descanso' : 'Detener foco'}
        >
          <Square className="size-3.5 fill-current" />
        </button>
      </div>
    </div>
  );

  // Banner móvil encima de la barra flotante (la barra ocupa 5.4rem contando su margen).
  const mobileWidget = (
    <div
      className={cn(
        'md:hidden fixed bottom-[5.6rem] left-0 right-0 z-(--z-overlay)',
        'flex items-center gap-3 border-t bg-card/95 backdrop-blur-sm px-4 py-2.5',
        isBreak ? 'border-blue-500/20 bg-blue-950/10' : 'border-border',
        isExpired && 'border-amber-500/30',
      )}
    >
      <div className={cn('flex items-center gap-2 shrink-0', isBreak ? 'text-blue-400' : 'text-amber-500')}>
        {isBreak ? <Coffee className="size-4" /> : <Timer className="size-4 animate-pulse" />}
        <span className="text-sm font-bold tabular-nums">
          {isExpired ? 'Agotado' : timeDisplay}
        </span>
      </div>

      <p className="text-sm text-foreground truncate flex-1">
        {isBreak ? 'Descanso' : state.taskTitle}
      </p>

      <div className="flex gap-1 shrink-0">
        {!isBreak && !state.pageId && (
          <button
            onClick={() => dispatch({ type: 'COMPLETE_TASK' })}
            className="p-1.5 rounded-md text-muted-foreground hover:text-green-400 transition-colors"
            aria-label="Completar"
          >
            <CheckCircle2 className="size-4" />
          </button>
        )}
        <button
          onClick={() => dispatch(stopAction)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Detener"
        >
          <Square className="size-4 fill-current" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {desktopWidget}
      {mobileWidget}
    </>
  );
}
