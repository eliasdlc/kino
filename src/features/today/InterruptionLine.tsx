'use client';

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { useConvexMutation, useConvexQuery } from '@/shared/convex/hooks';
import { WeeklyRitualDialog } from '@/features/energy/WeeklyRitualDialog';

/**
 * La única interrupción del día, encima del plan.
 *
 * Es una línea, no una tarjeta, y hay como mucho una: el servidor decide cuál
 * de todos los candidatos la ocupa (`convex/today.ts`) y aquí sólo se pinta.
 * Cuando no hay ninguna no se pinta nada, ni un hueco ni un esqueleto: una
 * pantalla que reserva sitio para una pregunta que no existe es peor que una
 * que no pregunta.
 *
 * Los dos botones cierran igual. Lo que la cola mide es si hubo respuesta, no
 * cuál fue, así que "Repartir" y "Ahora no" acusan recibo los dos y la línea no
 * vuelve.
 */

/** Lo que cada clase dice y qué hace su acción. Una clase sin línea no se pinta. */
type Contenido = { texto: React.ReactNode; accion: string };

function contenidoDe(kind: string, payload: Record<string, unknown>): Contenido | null {
  if (kind === 'ritual') {
    const vencidas = typeof payload.vencidas === 'number' ? payload.vencidas : 0;
    return {
      texto: (
        <>
          <b className="font-semibold text-foreground">
            {vencidas} vencida{vencidas !== 1 ? 's' : ''}
          </b>{' '}
          esperan un día esta semana.
        </>
      ),
      accion: 'Repartir',
    };
  }
  return null;
}

export function InterruptionLine() {
  const { data: interrupcion } = useConvexQuery(api.today.interruption, {});
  const { mutate: marcarMostrada } = useConvexMutation(api.today.markSurfaced);
  const { mutate: acusar } = useConvexMutation(api.today.acknowledge);
  const [abierto, setAbierto] = useState(false);

  const kind = interrupcion?.kind;
  const key = interrupcion?.key;

  // El reloj de los dos días arranca la primera vez que la persona la ve, así
  // que se marca al pintarla y no al calcularla: una interrupción que nadie
  // llegó a mirar no debería consumir su turno.
  useEffect(() => {
    if (kind && key) marcarMostrada({ kind, key });
  }, [kind, key, marcarMostrada]);

  if (!interrupcion) return null;
  const contenido = contenidoDe(interrupcion.kind, interrupcion.payload);
  if (!contenido) return null;

  const responder = () => acusar({ kind: interrupcion.kind, key: interrupcion.key });

  return (
    <>
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 line-clamp-2 text-sm text-foreground/80">{contenido.texto}</p>
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          onClick={() => {
            setAbierto(true);
            responder();
          }}
        >
          {contenido.accion}
        </Button>
        <Button variant="ghost" size="sm" className="h-auto px-0 text-muted-foreground" onClick={responder}>
          Ahora no
        </Button>
      </div>

      {interrupcion.kind === 'ritual' && <WeeklyRitualDialog open={abierto} onOpenChange={setAbierto} />}
    </>
  );
}
