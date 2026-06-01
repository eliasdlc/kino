'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ActiveTimer {
  taskId: string;
  systemId: string;
  taskTitle: string;
  startedAt: string; // ISO timestamp
  elapsedSeconds: number;
}

interface TimerState {
  active: ActiveTimer | null;
  startTimer: (taskId: string, systemId: string, taskTitle: string) => void;
  stopTimer: () => ActiveTimer | null;
  tickTimer: () => void;
  syncElapsed: () => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      active: null,

      startTimer: (taskId, systemId, taskTitle) =>
        set({
          active: {
            taskId,
            systemId,
            taskTitle,
            startedAt: new Date().toISOString(),
            elapsedSeconds: 0,
          },
        }),

      stopTimer: () => {
        const snap = get().active;
        set({ active: null });
        return snap;
      },

      tickTimer: () =>
        set((s) =>
          s.active
            ? { active: { ...s.active, elapsedSeconds: s.active.elapsedSeconds + 1 } }
            : s,
        ),

      // Resync elapsed time from startedAt after page reload
      syncElapsed: () => {
        const { active } = get();
        if (!active) return;
        const elapsed = Math.floor(
          (Date.now() - new Date(active.startedAt).getTime()) / 1000,
        );
        set({ active: { ...active, elapsedSeconds: Math.max(0, elapsed) } });
      },
    }),
    {
      name: 'kino-active-timer',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return localStorage;
      }),
      partialize: (s) => ({ active: s.active }),
    },
  ),
);
