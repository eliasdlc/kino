'use client';

import { useState } from 'react';
import { Timer, Clock, Infinity as InfinityIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EstimatedTimePicker } from './EstimatedTimePicker';
import { useFocusTimer, type TimerMode } from './FocusTimerProvider';
import { cn } from '@/lib/utils';

interface ModeOption {
  mode: TimerMode;
  icon: React.ElementType;
  label: string;
  description: string;
}

const MODES: ModeOption[] = [
  { mode: 'pomodoro', icon: Timer, label: 'Pomodoro', description: '25 min trabajo · 5 min descanso' },
  { mode: 'estimated', icon: Clock, label: 'Estimado', description: 'Cuenta regresiva según tu estimación' },
  { mode: 'free', icon: InfinityIcon, label: 'Libre', description: 'Cronómetro sin límite' },
];

export function FocusTimerModeDialog() {
  const { state, pendingTask, showModeDialog, dispatch, closeModeDialog } = useFocusTimer();
  const [localEstimate, setLocalEstimate] = useState<number | null>(null);
  const [askingEstimate, setAskingEstimate] = useState(false);

  function handleClose() {
    closeModeDialog();
    setAskingEstimate(false);
    setLocalEstimate(null);
  }

  function handleModeClick(mode: TimerMode) {
    if (mode === 'estimated') {
      const existing = pendingTask?.estimatedDuration ?? localEstimate;
      if (!existing) {
        setAskingEstimate(true);
        return;
      }
      startTimer(mode, existing);
      return;
    }
    startTimer(mode);
  }

  function startTimer(mode: TimerMode, estimatedMinutes?: number | null) {
    if (!pendingTask) return;
    dispatch({
      type: 'START',
      taskId: pendingTask.id,
      taskTitle: pendingTask.title,
      systemId: pendingTask.systemId,
      mode,
      estimatedMinutes: estimatedMinutes ?? undefined,
    });
    handleClose();
  }

  const isRunning = state.phase !== 'idle' && state.phase !== 'recap';
  const effectiveEstimate = pendingTask?.estimatedDuration ?? localEstimate;

  return (
    <Dialog
      open={showModeDialog}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base truncate">
            {isRunning
              ? 'Ya hay un timer activo'
              : pendingTask
              ? `Enfocarme en "${pendingTask.title}"`
              : 'Iniciar foco'}
          </DialogTitle>
        </DialogHeader>

        {isRunning ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              ¿Detener el timer actual y comenzar este?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  dispatch({ type: 'STOP' });
                  handleClose();
                }}
              >
                Detener actual
              </Button>
            </div>
          </div>
        ) : askingEstimate ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Cuánto tiempo estimás para esta tarea?
            </p>
            <EstimatedTimePicker value={localEstimate} onChange={setLocalEstimate} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAskingEstimate(false)}>
                Volver
              </Button>
              <Button
                size="sm"
                disabled={!localEstimate}
                onClick={() => startTimer('estimated', localEstimate)}
              >
                Comenzar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {MODES.map(({ mode, icon: Icon, label, description }) => (
              <button
                key={mode}
                onClick={() => handleModeClick(mode)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                  'border-border/40 hover:bg-accent hover:border-border/80',
                )}
              >
                <Icon className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {mode === 'estimated' && effectiveEstimate
                      ? `${effectiveEstimate} min (tu estimación)`
                      : description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
