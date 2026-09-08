"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useConvexMutation } from "@/shared/convex/hooks";
import { cuandoDe, sujetoDe, VERBOS, type ItemEvent } from "./item-events";

/**
 * Una fila del log, con su deshacer cuando lo tiene.
 *
 * **Botón o motivo, nunca un botón muerto.** Quién puede deshacerse lo decide el
 * servidor con la misma función que ejecuta la mutación, así que un botón que
 * se pinta es un botón que funciona; y cuando no se puede, la fila dice por qué
 * en vez de dejar la duda o pintar algo apagado que hay que pulsar para
 * enterarse.
 *
 * La autoría del agente no lleva punto ni insignia: hoy pulsarlo no llevaría a
 * ningún sitio, y lo que parece control es control.
 */
export function UndoableEventRow({ evento }: { evento: ItemEvent }) {
  const { mutate: deshacer, isPending } = useConvexMutation(api.eventLog.deshacer);
  // Un rechazo se lee donde estaba el botón, no en un aviso flotante: el motivo
  // habla de esta fila, y entre pulsar y leer no debería haber que mirar a otro
  // sitio. Es el mismo sitio donde el servidor pone los motivos que ya sabía.
  const [rechazo, setRechazo] = useState<string | null>(null);

  const frase = `${sujetoDe(evento.actor)} ${VERBOS[evento.action] ?? "hizo un cambio"} · ${cuandoDe(evento.occurredAt)}`;
  const motivo = rechazo ?? (evento.deshacer.forma === "no" ? evento.deshacer.motivo : null);

  return (
    // En el teléfono la frase y su afordancia van una debajo de otra: en línea,
    // el sujeto se estruja en media columna y hay que leer en zigzag. Desde
    // `sm` caben al lado, y el ancho se acota para que el motivo no acabe a
    // novecientos píxeles de la fila que explica.
    <li className="flex max-w-[46rem] flex-col gap-1 py-2 text-sm text-foreground/80 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span>
        {frase}
        {evento.undoneAt !== null && ` · deshecho ${cuandoDe(evento.undoneAt)}`}
      </span>

      {motivo !== null ? (
        <span className="text-foreground/80 sm:shrink-0 sm:text-right">{motivo}</span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start sm:shrink-0"
          disabled={isPending}
          onClick={() =>
            deshacer(
              { id: evento.id },
              {
                onSuccess: (resultado) => {
                  if (resultado.deshecho) toast.success("Listo, lo devolví como estaba.");
                  else setRechazo(resultado.motivo);
                },
                onError: () => setRechazo("No se pudo deshacer. Vuelve a intentarlo."),
              },
            )
          }
        >
          Deshacer
        </Button>
      )}
    </li>
  );
}
