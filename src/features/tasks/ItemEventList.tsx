"use client";

import { api } from "@convex/_generated/api";
import { useConvexQuery } from "@/shared/convex/hooks";
import { cuandoDe, sujetoDe, VERBOS, type ItemType } from "./item-events";

/**
 * Lo que le ha pasado a un item, lo más reciente primero.
 *
 * Es la lista **por item**, la que se abre desde el propio item. La fila diaria
 * de lo que hizo tu agente es otra cosa y vive en Hoy.
 *
 * **La autoría del agente no lleva punto de color ni insignia**, y es una
 * decisión: un punto pide que lo pulses, y hoy pulsarlo no lleva a ningún
 * sitio. Lo que parece control es control, así que la vía se dice con las
 * mismas palabras que el resto de la frase.
 */

export function ItemEventList({ targetType, targetId }: { targetType: ItemType; targetId: string }) {
  const { data, isLoading } = useConvexQuery(api.eventLog.porItem, { targetType, targetId });

  if (isLoading) {
    return (
      <ul className="space-y-2" aria-busy="true" aria-label="Cargando la actividad">
        {[0, 1, 2].map((linea) => (
          <li key={linea} className="h-4 w-full max-w-[24rem] rounded bg-muted" />
        ))}
      </ul>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-foreground/80">Aquí no ha pasado nada todavía.</p>;
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {items.map((evento) => (
          <li key={evento.id} className="text-sm text-foreground/80">
            {sujetoDe(evento.actor)} {VERBOS[evento.action] ?? "hizo un cambio"} · {cuandoDe(evento.occurredAt)}
            {evento.undoneAt !== null && " · deshecho después"}
          </li>
        ))}
      </ul>
      {(data?.restantes ?? 0) > 0 && (
        <p className="text-sm text-foreground/80">Hay {data!.restantes} más antes de éstos, dentro de los treinta días que se guardan.</p>
      )}
    </div>
  );
}
