'use client';

import { NotebookPen } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { EmptyState } from '@/components/ui/empty-state';
import { MarginRow } from '@/components/ui/margin-row';
import { useConvexQuery } from '@/shared/convex/hooks';
import { SheetLoading } from './settings-ui';

/**
 * Lo último que subió el hook del diario. Enseña fecha y tamaño, nunca el
 * contenido: el digest se lee en el laptop, que es donde vive el material
 * crudo. Sirve para una sola pregunta, que es la que se hace después de correr
 * el hook a mano: llegó o no llegó. Vive en su hoja, bajo Una vez.
 */

const fecha = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' });

/** Bytes en la unidad que se lee de un vistazo. Un digest ronda los 4 KB. */
function tamano(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function DigestsSection() {
  const { data } = useConvexQuery(api.digests.list, {});

  if (!data) return <SheetLoading rows={2} />;
  if (data.length === 0) {
    return (
      <EmptyState
        className="pl-(--margen)"
        title="Todavía no ha llegado ningún resumen."
        description="Corre el hook en tu laptop y la fila aparece aquí."
      />
    );
  }
  return (
    <ul>
      {data.map((digest) => (
        <li key={digest.id} className="border-b border-border last:border-b-0">
          <MarginRow
            className="border-b-0"
            margin={<NotebookPen aria-hidden className="mt-[0.5rem] size-5 stroke-[1.8]" />}
            trailing={tamano(digest.bytes)}
          >
            <span className="block truncate text-base leading-6 font-semibold text-foreground">
              {fecha.format(new Date(digest.createdAt))}
            </span>
            <span className="block truncate text-sm leading-5 text-muted-foreground">{digest.source}</span>
          </MarginRow>
        </li>
      ))}
    </ul>
  );
}
