'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Gauge, NotebookPen } from 'lucide-react';
import { InterruptionBody } from './InterruptionBody';
import { CeilingProposalBody, type CeilingProposal } from './CeilingProposalBody';
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
type Contenido = { texto: React.ReactNode; accion: string; icono: typeof CalendarClock };

const texto = (payload: Record<string, unknown>, clave: string) =>
  typeof payload[clave] === 'string' ? (payload[clave] as string) : '';

function contenidoDe(kind: string, payload: Record<string, unknown>): Contenido | null {
  if (kind === 'lunes') {
    return {
      texto: <InterruptionBody summary={texto(payload, 'summary')} quote={texto(payload, 'quote')} />,
      accion: 'Convertir en tarea',
      icono: NotebookPen,
    };
  }
  if (kind === 'techo') {
    const propuesta = payload as unknown as CeilingProposal;
    return {
      texto: <CeilingProposalBody propuesta={propuesta} />,
      accion: 'Ajustar el techo',
      icono: Gauge,
    };
  }
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
      icono: CalendarClock,
    };
  }
  return null;
}

export function InterruptionLine() {
  const { data: interrupcion } = useConvexQuery(api.today.interruption, {});
  const { mutate: marcarMostrada } = useConvexMutation(api.today.markSurfaced);
  const { mutate: acusar } = useConvexMutation(api.today.acknowledge);
  const { mutate: convertir } = useConvexMutation(api.today.taskFromDigest);
  const { mutate: ajustarTecho } = useConvexMutation(api.energy.applyCeiling);
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

  // La acción de cada clase. La del lunes crea la tarea y acusa en la misma
  // mutación, porque es `tasks.digestId` lo que la puerta de muerte del diario
  // cuenta, y no la pulsación.
  const actuar = () => {
    if (interrupcion.kind === 'lunes') {
      const { digestId, quote } = interrupcion.payload as { digestId?: string; quote?: string };
      if (digestId && quote) {
        convertir({ key: interrupcion.key, title: quote.slice(0, 200), digestId });
        return;
      }
    }
    if (interrupcion.kind === 'techo') {
      const { propuesto } = interrupcion.payload as { propuesto?: number };
      if (typeof propuesto === 'number') {
        ajustarTecho({ horas: propuesto });
        responder();
        return;
      }
    }
    setAbierto(true);
    responder();
  };

  return (
    <>
      {/* En el teléfono el texto va arriba y las acciones debajo: los dos
          botones en la misma fila dejaban la línea en tres palabras y un
          recorte, que es no decir nada. Desde `sm` vuelve a ser una fila. */}
      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 items-start gap-3 sm:flex-1 sm:items-center">
          <contenido.icono className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" />
          <p className="min-w-0 line-clamp-2 text-sm text-foreground/80">{contenido.texto}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
          <Button variant="link" size="sm" className="h-auto px-0" onClick={actuar}>
            {contenido.accion}
          </Button>
          <Button variant="ghost" size="sm" className="h-auto px-0 text-muted-foreground" onClick={responder}>
            Ahora no
          </Button>
        </div>
      </div>

      {interrupcion.kind === 'ritual' && <WeeklyRitualDialog open={abierto} onOpenChange={setAbierto} />}
    </>
  );
}
