'use client';

import { useEffect, useRef } from 'react';
import { Timer, Square } from 'lucide-react';
import { useTimerStore } from './timer.store';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusTimerWidget() {
  const active = useTimerStore((s) => s.active);
  const stopTimer = useTimerStore((s) => s.stopTimer);
  const tickTimer = useTimerStore((s) => s.tickTimer);
  const syncElapsed = useTimerStore((s) => s.syncElapsed);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount, resync elapsed from startedAt (handles page refresh)
  useEffect(() => {
    syncElapsed();
  }, [syncElapsed]);

  // Tick every second while active
  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(tickTimer, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, tickTimer]);

  if (!active) return null;

  async function handleStop() {
    const snap = stopTimer();
    if (!snap) return;

    const endedAt = new Date().toISOString();
    const durationMinutes = Math.max(0, Math.floor(snap.elapsedSeconds / 60));

    try {
      await fetch(`/api/tasks/${snap.taskId}/time-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId: snap.systemId,
          startedAt: snap.startedAt,
          endedAt,
          durationMinutes,
          source: 'timer',
        }),
      });
    } catch {
      // Silently fail — the log is a nice-to-have, not blocking
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border bg-card shadow-lg px-4 py-3 max-w-xs">
      <div className="flex items-center gap-2 text-amber-500 shrink-0">
        <Timer className="w-4 h-4 animate-pulse" />
        <span className="text-sm font-bold tabular-nums">
          {formatTime(active.elapsedSeconds)}
        </span>
      </div>

      <p className="text-sm text-foreground truncate flex-1 min-w-0">
        {active.taskTitle}
      </p>

      <button
        onClick={handleStop}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        aria-label="Detener foco"
      >
        <Square className="w-3.5 h-3.5 fill-current" />
      </button>
    </div>
  );
}
