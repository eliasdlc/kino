'use client';

import { useState } from 'react';
import { api } from '@convex/_generated/api';
import { useConvexQuery } from '@/shared/convex/hooks';

/** El día de la fecha, para la celda: "27" de "2026-08-27". */
function diaDe(date: string): string {
  return date.slice(-2);
}

/**
 * El techo apagado, y el único momento donde Kino pierde en público.
 *
 * La cifra va delante de todo: cuánto se equivocó, sobre cuántos días. Después,
 * las predicciones que lo demuestran, una celda por medición, y cada una abre su
 * propia fila: qué dijo Kino ese día y qué registraste tú. No es un enlace a una
 * lista aparte, porque el criterio es que cada una señale la suya, y no es una
 * celda muerta, porque un control que no hace nada no se pinta.
 *
 * `null` cuando el techo está encendido: no hay nada que confesar.
 */
export function CeilingMutedNotice() {
  const { data: honestidad } = useConvexQuery(api.energy.ceilingHonesty, {});
  const [abierta, setAbierta] = useState<string | null>(null);

  if (!honestidad || honestidad.errorMedio === null) return null;

  const detalle = honestidad.predicciones.find((p) => `${p.date}:${p.slot}` === abierta);

  return (
    <section
      aria-labelledby="techo-apagado"
      className="space-y-3 rounded-2xl border border-primary bg-primary/8 p-4"
    >
      <h2
        id="techo-apagado"
        className="font-display text-xl font-bold tracking-[-0.02em] text-primary"
      >
        Me equivoqué {honestidad.errorMedio} puntos al día, {honestidad.dias} días seguidos.
      </h2>
      <p className="text-sm text-foreground/80">
        Apagué el techo. Sigo midiendo el día, pero dejo de opinar sobre cuánto cabe.
      </p>

      <ul className="grid grid-cols-7 gap-1">
        {honestidad.predicciones.map((prediccion) => {
          const clave = `${prediccion.date}:${prediccion.slot}`;
          return (
            <li key={clave}>
              <button
                type="button"
                aria-pressed={abierta === clave}
                aria-label={`${prediccion.date}, error de ${prediccion.error} puntos`}
                onClick={() => setAbierta(abierta === clave ? null : clave)}
                data-fallo={prediccion.error > honestidad.umbral}
                className="grid h-12 w-full place-items-center rounded-md bg-card font-mono text-xs tabular-nums transition-colors aria-pressed:ring-1 aria-pressed:ring-primary data-[fallo=true]:bg-primary/20 data-[fallo=true]:font-bold data-[fallo=true]:text-primary"
              >
                {diaDe(prediccion.date)}
              </button>
            </li>
          );
        })}
      </ul>

      {detalle && (
        <p className="text-sm text-foreground/80">
          {detalle.date}: dije {detalle.predicted} y registraste {detalle.reported}.{' '}
          <b className="font-semibold text-primary">{detalle.error} de error.</b>
        </p>
      )}
    </section>
  );
}
