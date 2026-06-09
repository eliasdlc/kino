'use client';

import {
  createContext,
  useContext,
  useReducer,
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// ── Types ─────────────────────────────────────────────────────────────────

export type TimerPhase = 'idle' | 'working' | 'break' | 'recap';
export type TimerMode = 'pomodoro' | 'estimated' | 'free';

export interface TimerState {
  phase: TimerPhase;
  mode: TimerMode | null;
  taskId: string | null;
  taskTitle: string | null;
  systemId: string | null;
  estimatedMinutes: number | null;
  startedAt: number | null;
  durationMs: number | null;
  expired: boolean;
  breakStartedAt: number | null;
  breakDurationMs: number;
  recapWorkMs: number | null;
}

export type TimerAction =
  | { type: 'START'; taskId: string; taskTitle: string; systemId: string; mode: TimerMode; estimatedMinutes?: number }
  | { type: 'EXPIRE' }
  | { type: 'STOP' }
  | { type: 'COMPLETE_TASK' }
  | { type: 'END_BREAK' }
  | { type: 'RESET' };

export interface PendingTask {
  id: string;
  title: string;
  systemId: string;
  estimatedDuration?: number | null;
}

interface TimerContextValue {
  state: TimerState;
  dispatch: React.Dispatch<TimerAction>;
  remainingMs: () => number | null;
  elapsedMs: () => number;
  pendingTask: PendingTask | null;
  showModeDialog: boolean;
  openModeDialog: (task: PendingTask) => void;
  closeModeDialog: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const TimerContext = createContext<TimerContextValue | null>(null);

export function useFocusTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useFocusTimer must be inside FocusTimerProvider');
  return ctx;
}

// ── Reducer ────────────────────────────────────────────────────────────────

const INITIAL: TimerState = {
  phase: 'idle',
  mode: null,
  taskId: null,
  taskTitle: null,
  systemId: null,
  estimatedMinutes: null,
  startedAt: null,
  durationMs: null,
  expired: false,
  breakStartedAt: null,
  breakDurationMs: 5 * 60 * 1000,
  recapWorkMs: null,
};

function reducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'START': {
      const em = action.estimatedMinutes ?? null;
      const durMs =
        action.mode === 'pomodoro'
          ? 25 * 60 * 1000
          : action.mode === 'estimated' && em
          ? em * 60 * 1000
          : null;
      return {
        ...INITIAL,
        phase: 'working',
        mode: action.mode,
        taskId: action.taskId,
        taskTitle: action.taskTitle,
        systemId: action.systemId,
        estimatedMinutes: em,
        startedAt: Date.now(),
        durationMs: durMs,
        breakDurationMs: state.breakDurationMs,
      };
    }
    case 'EXPIRE': {
      if (state.phase !== 'working') return state;
      if (state.mode === 'pomodoro') {
        return { ...state, phase: 'break', breakStartedAt: Date.now() };
      }
      return { ...state, expired: true };
    }
    case 'STOP':
    case 'COMPLETE_TASK': {
      if (state.phase === 'idle') return state;
      const workMs = state.startedAt ? Date.now() - state.startedAt : 0;
      return { ...state, phase: 'recap', recapWorkMs: workMs };
    }
    case 'END_BREAK':
    case 'RESET':
      return INITIAL;
    default:
      return state;
  }
}

// ── Audio (Web Audio API, no files) ───────────────────────────────────────

function playChime(ctx: AudioContext) {
  const notes = [660, 880];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

// ── Session Recap Toast ───────────────────────────────────────────────────

const ENERGY_MAP = { high: 80, medium: 55, low: 30 } as const;

function formatWorked(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 1) return '< 1 min';
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}min` : ''}`.trim() : `${m} min`;
}

interface RecapToastProps {
  taskTitle: string;
  workedLabel: string;
  estimateMsg: string;
  onEnergy: (level: 'high' | 'medium' | 'low') => void;
  onDismiss: () => void;
}

function RecapToast({ taskTitle, workedLabel, estimateMsg, onEnergy, onDismiss }: RecapToastProps) {
  return (
    <div className="w-80 rounded-xl border bg-card shadow-lg p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          Trabajaste {workedLabel} en <span className="text-primary">&ldquo;{taskTitle}&rdquo;</span>
        </p>
        {estimateMsg && <p className="text-xs text-muted-foreground mt-0.5">{estimateMsg}</p>}
      </div>
      <p className="text-xs text-muted-foreground">¿Cómo fue tu energía?</p>
      <div className="flex gap-2">
        {(['high', 'medium', 'low'] as const).map((level) => (
          <button
            key={level}
            onClick={() => onEnergy(level)}
            className="flex-1 py-1.5 rounded-lg text-sm border border-border hover:bg-accent transition-colors"
          >
            {level === 'high' ? '🔥 Alta' : level === 'medium' ? '⚡ Media' : '🌙 Baja'}
          </button>
        ))}
      </div>
      <button onClick={onDismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors text-right">
        Omitir
      </button>
    </div>
  );
}

// ── Provider ───────────────────────────────────────────────────────────────

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [pendingTask, setPendingTask] = useState<PendingTask | null>(null);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevPhaseRef = useRef<TimerPhase>('idle');
  const recapShownRef = useRef(false);
  const queryClient = useQueryClient();

  // Tick: re-evaluate expiry every second while timer is running
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'recap') return;
    const id = setInterval(() => {
      if (state.phase === 'working' && !state.expired && state.durationMs !== null && state.startedAt !== null) {
        if (Date.now() - state.startedAt >= state.durationMs) dispatch({ type: 'EXPIRE' });
      }
      if (state.phase === 'break' && state.breakStartedAt !== null) {
        if (Date.now() - state.breakStartedAt >= state.breakDurationMs) dispatch({ type: 'END_BREAK' });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [state.phase, state.expired, state.durationMs, state.startedAt, state.breakStartedAt, state.breakDurationMs]);

  // Chime on expire or on transition to break phase
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) { prevPhaseRef.current = state.phase; return; }
    if (state.expired) playChime(ctx);
    if (prevPhaseRef.current === 'working' && state.phase === 'break') playChime(ctx);
    prevPhaseRef.current = state.phase;
  }, [state.expired, state.phase]);

  // Session recap toast — fires once when phase becomes 'recap'
  useEffect(() => {
    if (state.phase !== 'recap' || recapShownRef.current) return;
    recapShownRef.current = true;

    const { taskId, taskTitle, systemId, recapWorkMs, estimatedMinutes } = state;
    if (!taskId || !taskTitle || !systemId) { dispatch({ type: 'RESET' }); return; }

    const workMs = recapWorkMs ?? 0;
    const workedMinutes = Math.round(workMs / 60000);
    const workedLabel = formatWorked(workMs);
    const startedAt = new Date(Date.now() - workMs).toISOString();
    const endedAt = new Date().toISOString();

    let estimateMsg = '';
    if (estimatedMinutes && workedMinutes > 0) {
      if (workedMinutes <= Math.round(estimatedMinutes * 1.1)) {
        estimateMsg = `Estimaste ${estimatedMinutes} min — ¡buen ojo!`;
      } else if (workedMinutes > Math.round(estimatedMinutes * 1.5)) {
        estimateMsg = `Estimaste ${estimatedMinutes} min, trabajaste ${workedMinutes} min`;
      }
    }

    const logTime = () =>
      workedMinutes > 0
        ? fetch(`/api/tasks/${taskId}/time-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemId, startedAt, endedAt, durationMinutes: workedMinutes, source: 'pomodoro' }),
          })
            .then(() => queryClient.invalidateQueries({ queryKey: ['time-logs', taskId] }))
            .catch(() => {})
        : Promise.resolve();

    const reset = () => {
      recapShownRef.current = false;
      dispatch({ type: 'RESET' });
    };

    toast.custom(
      (id) => (
        <RecapToast
          taskTitle={taskTitle}
          workedLabel={workedLabel}
          estimateMsg={estimateMsg}
          onEnergy={async (level) => {
            toast.dismiss(id);
            await Promise.allSettled([
              fetch('/api/energy/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentLevel: ENERGY_MAP[level], sleepQuality: 'partial' }),
              }).then(() => queryClient.invalidateQueries({ queryKey: ['energy'] })),
              logTime(),
            ]);
            reset();
          }}
          onDismiss={() => {
            toast.dismiss(id);
            logTime();
            reset();
          }}
        />
      ),
      { duration: Infinity },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === 'idle') recapShownRef.current = false;
  }, [state.phase]);

  const remainingMs = useCallback(() => {
    if (state.phase === 'working' && state.durationMs !== null && state.startedAt !== null) {
      return Math.max(0, state.durationMs - (Date.now() - state.startedAt));
    }
    if (state.phase === 'break' && state.breakStartedAt !== null) {
      return Math.max(0, state.breakDurationMs - (Date.now() - state.breakStartedAt));
    }
    return null;
  }, [state]);

  const elapsedMs = useCallback(() => {
    if (!state.startedAt || state.phase === 'idle') return 0;
    return Date.now() - state.startedAt;
  }, [state]);

  const openModeDialog = useCallback((task: PendingTask) => {
    if (!audioCtxRef.current) {
      // AudioContext must be created in a user gesture
      audioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } else if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    setPendingTask(task);
    setShowModeDialog(true);
  }, []);

  const closeModeDialog = useCallback(() => {
    setShowModeDialog(false);
    setPendingTask(null);
  }, []);

  return (
    <TimerContext.Provider
      value={{ state, dispatch, remainingMs, elapsedMs, pendingTask, showModeDialog, openModeDialog, closeModeDialog }}
    >
      {children}
    </TimerContext.Provider>
  );
}
