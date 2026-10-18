'use client';

import { useState } from 'react';
import { api } from '@convex/_generated/api';
import { useConvexQuery } from '@/shared/convex/hooks';
import { SectionHead } from '@/features/dashboard/SectionHead';

/** El día de la fecha, para la celda: "27" de "2026-08-27". */
function diaDe(date: string): string {
  return date.slice(-2);
}

/**
 * El techo apagado, y el único momento en que la previsión pierde en público.
 *
 * La cifra va delante de todo: cuánto falló, sobre cuántos días. Después, las
 * mediciones que lo demuestran, una celda por día, y cada una abre su propia
 * línea: lo previsto ese día y lo que registraste tú. No es un enlace a una
 * lista aparte, porque el criterio es que cada una señale la suya, y no es una
 * celda muerta, porque un control que no hace nada no se pinta.
 *
 * Es una sección de Diario: título con hairline, la frase en tinta y las
 * celdas como numerales sin caja; los días que fallaron van en tinta y peso,
 * los demás en mute, y la elegida se subraya en el acento porque es la activa.
 * El sujeto es la previsión, nunca Kino.
 *
 * `null` cuando el techo está encendido: no hay nada que confesar.
 */
export function CeilingMutedNotice() {
  const { data: honestidad } = useConvexQuery(api.energy.ceilingHonesty, {});
  const [abierta, setAbierta] = useState<string | null>(null);

  if (!honestidad || honestidad.errorMedio === null) return null;

  const detalle = honestidad.predicciones.find((p) => `${p.date}:${p.slot}` === abierta);

  return (
    <section aria-labelledby="techo-apagado" className="space-y-3">
      <SectionHead id="techo-apagado" title="El techo, apagado" />

      <div className="space-y-3 pl-(--margen)">
        <p className="font-display text-xl leading-tight font-bold tracking-[-0.02em] text-foreground">
          La previsión falló {honestidad.errorMedio} puntos al día, {honestidad.dias} días seguidos.
        </p>
        <p className="font-voice text-[0.98rem] leading-snug text-body italic">
          El día se sigue midiendo, pero sin opinar sobre cuánto cabe.
        </p>

        <ul className="grid grid-cols-7">
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
                  className="focus-ring grid h-12 w-full place-items-center rounded-md text-sm text-muted-foreground tabular-nums decoration-2 underline-offset-[0.35em] transition-colors duration-(--dur-toque) ease-(--ease-pluma) aria-pressed:text-foreground aria-pressed:underline aria-pressed:decoration-primary data-[fallo=true]:font-bold data-[fallo=true]:text-foreground"
                >
                  {diaDe(prediccion.date)}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-[0.78rem] text-muted-foreground">
          En tinta, los días que fallaron por más de {honestidad.umbral} puntos.
        </p>

        {detalle && (
          <p className="border-t border-border pt-2.5 text-sm text-body tabular-nums">
            {detalle.date}: previsto {detalle.predicted}, registraste {detalle.reported}.{' '}
            <b className="font-semibold text-foreground">{detalle.error} de error.</b>
          </p>
        )}
      </div>
    </section>
  );
}
