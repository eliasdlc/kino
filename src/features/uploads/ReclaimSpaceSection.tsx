'use client';

import { useState } from 'react';
import { useLocalMutation } from '@/shared/convex/hooks';
import { Eraser } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { SweepResult } from './image-sweep';

/** 1,2 MB: un tamaño se lee mejor que un número de bytes. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

function summarize(result: SweepResult): string {
  if (result.aborted) {
    return 'No se liberó nada: el barrido no reconoció ninguna de tus imágenes en uso y prefirió no borrar.';
  }
  if (result.deleted === 0) {
    return 'No había nada que liberar: todas tus imágenes siguen en uso.';
  }
  const imagenes = result.deleted === 1 ? '1 imagen' : `${result.deleted} imágenes`;
  const base = `${imagenes} sin usar, ${formatBytes(result.freedBytes)} liberados.`;
  return result.incomplete ? `${base} Quedaron más: vuelve a ejecutarlo.` : base;
}

/**
 * Recupera el espacio de las imágenes que ya no referencia ningún contenido.
 *
 * El mismo barrido corre a diario por cron; este botón existe para el espacio que
 * se perdió *antes* de que el barrido existiera, y para no tener que esperar un día
 * después de una limpieza grande.
 */
export function ReclaimSpaceSection() {
  const [lastResult, setLastResult] = useState<SweepResult | null>(null);

  const { mutate, isPending } = useLocalMutation(
    async (): Promise<SweepResult> => {
      const res = await fetch('/api/uploads/sweep', { method: 'POST' });
      if (res.status === 503) {
        throw new Error('El almacenamiento de imágenes no está configurado');
      }
      if (!res.ok) throw new Error('No se pudo liberar el espacio');
      return res.json();
    },
    {
    onSuccess: (result) => {
      setLastResult(result);
      if (result.aborted) toast.warning(summarize(result));
      else toast.success(summarize(result));
    },
    onError: (error: Error) => toast.error(error.message),
    },
  );

  return (
    // Una fila, no una caja: la hoja de Datos ya agrupa, y el hairline lo pone
    // la lista que la monta.
    <div className="flex items-start gap-3">
      <Eraser aria-hidden className="mt-[0.2rem] size-5 shrink-0 stroke-[1.8] text-muted-foreground" />
      <div className="min-w-0 space-y-1">
        <p className="text-base leading-6 font-semibold text-foreground">Liberar espacio de imágenes</p>
        <p className="text-sm leading-5 text-muted-foreground">
          Borra las imágenes que ya no aparecen en ninguna página ni ficha. Las subidas
          en las últimas 24 horas nunca se tocan.
        </p>
        {lastResult ? (
          <p className="text-sm leading-5 text-foreground" aria-live="polite">
            {summarize(lastResult)}
          </p>
        ) : null}
        <div className="pt-1">
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => mutate()}>
            {isPending ? 'Liberando el espacio' : 'Liberar espacio'}
          </Button>
        </div>
      </div>
    </div>
  );
}
