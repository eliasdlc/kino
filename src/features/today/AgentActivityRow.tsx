"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import { FRASES } from "@/features/tasks/item-events";

/**
 * Lo que hizo tu agente hoy, bajo el plan.
 *
 * **No es una interrupción.** No pide ninguna decisión, así que no pasa por la
 * cola ni gasta la única apertura del día: si la gastara, la línea del lunes o
 * una propuesta se quedarían fuera por algo que no hay que contestar.
 *
 * Con cero acciones no se pinta nada. Ni un hueco, ni un «sin actividad»: una
 * pantalla que reserva sitio para contar que no pasó nada cuenta algo que nadie
 * preguntó.
 *
 * El sujeto es **tu agente**, nunca Kino, y la cifra va delante de la clase:
 * «creó 4 tareas», no «creó tareas (4)».
 */

/**
 * «creó 4 tareas y movió 1» a partir de lo que el servidor contó.
 *
 * Cuando dos tramos seguidos hablan de la misma clase, el segundo se queda sólo
 * con la cifra: «creó 4 tareas y movió 1 tarea» dice dos veces lo mismo, y la
 * frase de una línea no tiene sitio para repetirse.
 */
function frase(acciones: readonly { action: string; cuantas: number }[]): string {
  let anterior: string | null = null;
  const partes = acciones.map(({ action, cuantas }) => {
    const copy = FRASES[action];
    if (!copy) return `hizo ${cuantas}`;
    const texto = `${copy.verbo} ${copy.clase === anterior ? cuantas : copy.resumen(cuantas)}`;
    anterior = copy.clase;
    return texto;
  });
  if (partes.length === 1) return partes[0]!;
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

export function AgentActivityRow() {
  const { data } = useConvexQuery(api.eventLog.delAgenteHoy, {});
  const { mutate: deshacer, isPending } = useConvexMutation(api.eventLog.deshacerDelAgente);
  const [abierto, setAbierto] = useState(false);

  if (!data) return null;

  const donde = data.sistemas.length === 0 ? "" : ` en ${data.sistemas.join(" y ")}`;

  return (
    <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
      <p className="text-sm text-foreground/80">
        Tu agente {frase(data.acciones)}
        {donde}.
      </p>

      <div className="flex items-center gap-3">
        <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setAbierto((previo) => !previo)}>
          {abierto ? "Ocultar las acciones" : `Ver las ${data.total} acciones`}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-muted-foreground"
          disabled={isPending}
          onClick={() =>
            deshacer(
              {},
              {
                onSuccess: ({ deshechas, sinDeshacer }) => {
                  toast.success(`Deshechas ${deshechas} de ${data.total}.`);
                  // Lo que no volvió se dice, no se calla: una cifra que no
                  // cuadra con lo que ves en pantalla es peor que un aviso.
                  if (sinDeshacer.length > 0) toast.error(sinDeshacer[0]!);
                },
                onError: () => toast.error("No se pudo deshacer. Vuelve a intentarlo."),
              },
            )
          }
        >
          Deshacer
        </Button>
      </div>

      {abierto && (
        <ul className="space-y-1">
          {data.acciones.map(({ action, cuantas }) => (
            <li key={action} className="text-sm text-foreground/80">
              {FRASES[action]?.verbo ?? "hizo"} {FRASES[action]?.resumen(cuantas) ?? cuantas}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
