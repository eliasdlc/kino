'use client';

import { NotebookPen } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Skeleton } from '@/components/ui/skeleton';
import { useConvexQuery } from '@/shared/convex/hooks';

/**
 * Lo último que subió el hook del diario. Enseña fecha y tamaño, nunca el
 * contenido: el digest se lee en el laptop, que es donde vive el material
 * crudo. Sirve para una sola pregunta, que es la que se hace después de correr
 * el hook a mano: llegó o no llegó.
 */

const fecha = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' });

/** Bytes en la unidad que se lee de un vistazo. Un digest ronda los 4 KB. */
function tamano(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function DigestsSection() {
  const { data, isLoading } = useConvexQuery(api.digests.list, {});

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Diario de sesiones</h2>
        <p className="text-sm text-muted-foreground">
          El hook de tu laptop sube un resumen de cada sesión de trabajo. Aquí sólo se guarda el
          resumen; nada crudo sale de tu disco.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : data && data.length > 0 ? (
        <ul className="rounded-lg border divide-y">
          {data.map((digest) => (
            <li key={digest.id} className="flex items-center justify-between gap-4 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <NotebookPen className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{fecha.format(new Date(digest.createdAt))}</p>
                  <p className="text-xs text-muted-foreground truncate">{digest.source}</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground shrink-0">{tamano(digest.bytes)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border p-4 text-sm">Todavía no ha llegado ningún resumen.</p>
      )}
    </div>
  );
}
