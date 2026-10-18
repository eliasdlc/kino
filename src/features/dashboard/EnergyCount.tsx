'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

/** La duración de la cuenta, la misma que `--dur-cuenta` en globals.css. */
export const COUNT_DURATION_MS = 550;

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

/** Cuenta de 0 al valor al montar y anima los cambios posteriores; apagada, devuelve el valor. */
function useCountUp(target: number, enabled: boolean): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (!enabled) {
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return enabled ? val : target;
}

/**
 * La cifra de la cota, sola. Bricolage 800 a 4.4rem en el acento, con su
 * cuenta de 550 ms en ease-out cúbico. Vive aparte para que los fotogramas de
 * la cuenta repinten este span y nada más: la curva, el segmento y el
 * formulario no se enteran. Con movimiento reducido la cifra sale ya puesta.
 */
export function EnergyCount({ value, className }: { value: number; className?: string }) {
  const animate = !usePrefersReducedMotion();
  const shown = useCountUp(value, animate);
  return (
    <span
      data-slot="cota"
      className={cn(
        'font-display text-[4.4rem] leading-[0.86] font-extrabold tracking-[-0.04em] text-primary tabular-nums',
        className,
      )}
    >
      {shown}
    </span>
  );
}
