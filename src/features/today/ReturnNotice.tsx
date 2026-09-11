'use client';

import { api } from '@convex/_generated/api';
import { useConvexQuery } from '@/shared/convex/hooks';

/**
 * Lo que pasó mientras no estabas, bajo el plan.
 *
 * No pide ninguna decisión, así que no es la interrupción del día y no gasta su
 * apertura: si hoy además hay una línea arriba, salen las dos.
 *
 * Cuando no hay datos de energía de esos días se dice **en la misma frase y con
 * el mismo tamaño de letra** que el resto, no en gris pequeño al final. Es la
 * regla de la voz: lo que Kino no sabe pesa lo mismo que lo que sabe.
 */

const fecha = new Intl.DateTimeFormat('es-DO', { dateStyle: 'long' });

const plural = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export function ReturnNotice() {
  const { data } = useConvexQuery(api.today.returnNotice, {});
  if (!data) return null;

  const { dias, ultimaSesion, vencidas, repetidas, conEnergia } = data;

  return (
    <p className="text-sm text-foreground/80">
      Última sesión: {fecha.format(new Date(ultimaSesion))}. {plural(vencidas, 'tarea venció', 'tareas vencieron')}{' '}
      mientras tanto y {plural(repetidas, 'se repitió sola', 'se repitieron solas')}.
      {!conEnergia && ` No hay datos de energía de estos ${dias} días, así que el techo de hoy usa tu curva anterior.`}
    </p>
  );
}
