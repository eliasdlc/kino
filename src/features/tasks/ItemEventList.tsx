"use client";

import { api } from "@convex/_generated/api";
import { useConvexQuery } from "@/shared/convex/hooks";
import { type ItemType } from "./item-events";
import { UndoableEventRow } from "./UndoableEventRow";

/**
 * Lo que le ha pasado a un item, lo más reciente primero.
 *
 * Es la lista **por item**, la que se abre desde el propio item. La fila diaria
 * de lo que hizo tu agente es otra cosa y vive en Hoy.
 *
 * Cada fila la pinta `UndoableEventRow`, que es quien decide si lleva botón de
 * deshacer o el motivo por el que no.
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
      {/* Hairline arriba en las filas a partir de la segunda: sin él, la frase y
          el motivo de una fila se leen como dos filas distintas. */}
      <ul className="divide-y divide-border/60">
        {items.map((evento) => (
          <UndoableEventRow key={evento.id} evento={evento} />
        ))}
      </ul>
      {(data?.restantes ?? 0) > 0 && (
        <p className="text-sm text-foreground/80">Hay {data!.restantes} más antes de éstos, dentro de los treinta días que se guardan.</p>
      )}
    </div>
  );
}
