'use client';

import { useEffect, useReducer } from 'react';
import { Square, Timer, CheckCircle2, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTimer } from './FocusTimerProvider';
import { useTecladoAbierto } from '@/hooks/use-teclado-abierto';

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

/**
 * Lo que el banner del móvil le suma al chrome inferior mientras corre. Va a
 * `--kino-bottom-chrome` por la misma vía que la barra, así que con el timer
 * puesto la última fila de una lista sigue quedando a la vista.
 */
const ALTO_DEL_BANNER = '3.4rem';

export function FocusTimerWidget() {
  const { state, dispatch, remainingMs, elapsedMs } = useFocusTimer();
  const tecladoAbierto = useTecladoAbierto();

  // Force re-render every second while timer is running
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'recap') return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  const activo = state.phase !== 'idle' && state.phase !== 'recap';
  useEffect(() => {
    const raiz = document.documentElement;
    if (activo) raiz.style.setProperty('--kino-bottom-timer', ALTO_DEL_BANNER);
    else raiz.style.removeProperty('--kino-bottom-timer');
    return () => {
      raiz.style.removeProperty('--kino-bottom-timer');
    };
  }, [activo]);

  if (!activo) return null;

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
        isBreak && 'border-secondary bg-secondary',
        isExpired && 'border-primary/50',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 shrink-0',
          isBreak ? 'text-foreground' : isExpired ? 'text-primary' : 'text-primary',
        )}
      >
        {isBreak ? (
          <Coffee className="size-4" />
        ) : (
          <Timer className={cn('size-4', !isExpired && !isFree && '')} />
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
            className="p-1.5 rounded-md text-muted-foreground hover:text-task-done hover:bg-task-done/10 transition-colors"
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

  // Banner móvil encima del pie, cuya altura sale de la misma variable que la
  // reserva de `<main>`: nadie repite el número. Papel con hairline como el
  // pie, y fuera mientras el teclado está abierto, igual que él.
  const mobileWidget = tecladoAbierto ? null : (
    <div
      className={cn(
        'md:hidden fixed bottom-[calc(var(--kino-bottom-nav)+env(safe-area-inset-bottom))] left-0 right-0 z-(--z-overlay)',
        'flex items-center gap-3 border-t bg-background pl-4 pr-2 py-1',
        isBreak ? 'border-secondary bg-secondary' : 'border-border',
        isExpired && 'border-primary/30',
      )}
    >
      <div className={cn('flex items-center gap-2 shrink-0', isBreak ? 'text-foreground' : 'text-primary')}>
        {isBreak ? <Coffee className="size-4" /> : <Timer className="size-4 " />}
        <span className="text-sm font-bold tabular-nums">
          {isExpired ? 'Agotado' : timeDisplay}
        </span>
      </div>

      <p className="text-sm text-foreground truncate flex-1">
        {isBreak ? 'Descanso' : state.taskTitle}
      </p>

      <div className="flex gap-2 shrink-0">
        {!isBreak && !state.pageId && (
          <button
            onClick={() => dispatch({ type: 'COMPLETE_TASK' })}
            className="flex size-[2.85rem] items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-toque) focus-ring hover:text-task-done"
            aria-label="Completar"
          >
            <CheckCircle2 className="size-5" />
          </button>
        )}
        <button
          onClick={() => dispatch(stopAction)}
          className="flex size-[2.85rem] items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-toque) focus-ring hover:text-destructive"
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
