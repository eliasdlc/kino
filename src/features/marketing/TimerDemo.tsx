"use client";

import { useEffect, useRef, useState } from "react";

const TOTAL = 25 * 60;

/** Mini focus-timer interactivo para la sección "La inteligencia" del landing. */
export function TimerDemo() {
  const [left, setLeft] = useState(TOTAL);
  const [on, setOn] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  function toggle() {
    if (on) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setOn(false);
      return;
    }
    intervalRef.current = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setOn(false);
          return TOTAL;
        }
        return prev - 1;
      });
    }, 1000);
    setOn(true);
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const pct = (((TOTAL - left) / TOTAL) * 100).toFixed(1);

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={toggle}
        aria-label="Probar el timer"
        className="flex h-[74px] w-[74px] flex-none items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--ac) ${pct}%, color-mix(in srgb, var(--ink) 9%, transparent) 0)`,
        }}
      >
        <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-card font-jetbrains text-sm font-semibold text-foreground">
          {mm}:{ss}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-sm font-semibold text-foreground/85">
          {on ? "Sesión en curso: toca para pausar" : "Toca el timer para probarlo"}
        </p>
        <p className="text-[13px] text-muted-foreground">
          Pomodoro, estimado o libre. Al parar, un toque registra cómo fue tu energía.
        </p>
      </div>
    </div>
  );
}
