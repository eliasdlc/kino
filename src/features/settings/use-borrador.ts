'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Cuánto espera un paso del stepper antes de guardarse: lo que tarda un segundo toque. */
export const ESPERA_GUARDADO_MS = 450;

/**
 * El valor de un control que guarda al tocar pero no en cada toque: el
 * stepper del límite diario, el cronotipo, las pastillas de recarga. Cada
 * toque se ve al instante (el borrador) y lo que se escribe en la cuenta es
 * el último, cuando los toques paran. Cinco
 * toques seguidos son una escritura y no cinco, y el número no salta hacia
 * atrás cuando la primera respuesta llega antes que el quinto toque.
 *
 * El borrador se suelta cuando la escritura termina, salga bien o mal: si
 * sale bien, la cuenta ya dice lo mismo; si sale mal, el control vuelve al
 * valor de la cuenta, que es lo que de verdad quedó. Si el control se
 * desmonta con un toque pendiente (se cierra la hoja), se guarda en ese
 * momento en vez de perderse.
 *
 * Con `espera` 0 sirve para un control de un toque (un segmento): lo elegido
 * se ve en el acto, sin esperar la vuelta del servidor.
 *
 * @param servidor el valor de la cuenta, o undefined mientras carga
 * @param guardar escribe el valor y avisa cuando terminó
 */
export function useBorrador<T>(
  servidor: T | undefined,
  guardar: (valor: T, terminado: () => void) => void,
  espera = ESPERA_GUARDADO_MS,
): [T | undefined, (valor: T) => void] {
  const [borrador, setBorrador] = useState<{ valor: T } | null>(null);
  const pendiente = useRef<{ valor: T; timer: ReturnType<typeof setTimeout> } | null>(null);
  const guardarRef = useRef(guardar);

  useEffect(() => {
    guardarRef.current = guardar;
  }, [guardar]);

  const escribir = useCallback((valor: T) => {
    guardarRef.current(valor, () => setBorrador((actual) => (actual?.valor === valor ? null : actual)));
  }, []);

  const cambiar = useCallback(
    (valor: T) => {
      setBorrador({ valor });
      if (pendiente.current) clearTimeout(pendiente.current.timer);
      pendiente.current = {
        valor,
        timer: setTimeout(() => {
          pendiente.current = null;
          escribir(valor);
        }, espera),
      };
    },
    [escribir, espera],
  );

  useEffect(
    () => () => {
      const quedaba = pendiente.current;
      if (!quedaba) return;
      clearTimeout(quedaba.timer);
      pendiente.current = null;
      guardarRef.current(quedaba.valor, () => {});
    },
    [],
  );

  return [borrador ? borrador.valor : servidor, cambiar];
}
