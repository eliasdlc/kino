'use client';

import { useMemo } from 'react';
import { Box, FileText, Folder, ListTodo, RotateCcw, StickyNote } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MarginRow } from '@/components/ui/margin-row';
import { useConvexMutation, useConvexQuery } from '@/shared/convex/hooks';
import { SheetLoading } from './settings-ui';

/**
 * La papelera de la cuenta, con las cinco clases que se borran blando: tareas,
 * capítulos, entidades, carpetas y notas adhesivas. Una sola lista ordenada
 * por cuándo se borró, porque la pregunta que trae a alguien aquí es «qué
 * borré hace un rato», no «qué carpetas tengo borradas».
 *
 * Lo que se fue en cascada no se lista aparte: una subcarpeta o una nota que
 * cayó con su carpeta vuelve con ella, y la fila lo dice para que restaurar no
 * sea una sorpresa.
 *
 * Vive en su hoja, y las cinco suscripciones sólo existen mientras la hoja
 * está abierta: abrir Ajustes ya no lee la papelera entera.
 */

// Día y mes: cabe al lado de Restaurar en 393 px, y lo borrado vive semanas, no años.
const fecha = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' });

type Clase = 'task' | 'page' | 'entity' | 'folder' | 'note';

const ICONO = { task: ListTodo, page: FileText, entity: Box, folder: Folder, note: StickyNote } as const;
const ETIQUETA = { task: 'Tarea', page: 'Capítulo', entity: 'Entidad', folder: 'Carpeta', note: 'Nota adhesiva' } as const;

interface Fila {
  readonly clase: Clase;
  readonly id: string;
  readonly titulo: string;
  /** Lo que vuelve con ella, si algo se fue en cascada. */
  readonly arrastre: string | null;
  readonly deletedAt: string;
}

export function TrashSection() {
  const tareas = useConvexQuery(api.tasks.list, { deleted: true });
  const capitulos = useConvexQuery(api.pages.trashed, {});
  const entidades = useConvexQuery(api.entities.trashed, {});
  const carpetas = useConvexQuery(api.folders.trashed, {});
  const notas = useConvexQuery(api.stickyNotes.trashed, {});

  const restaurar = {
    task: useConvexMutation(api.tasks.restore, { map: (id: string) => ({ id }) }),
    page: useConvexMutation(api.pages.restore, { map: (id: string) => ({ id }) }),
    entity: useConvexMutation(api.entities.restore, { map: (id: string) => ({ id }) }),
    folder: useConvexMutation(api.folders.restore, { map: (id: string) => ({ id }) }),
    note: useConvexMutation(api.stickyNotes.restore, { map: (id: string) => ({ id }) }),
  } as const;

  const cargando =
    tareas.isLoading || capitulos.isLoading || entidades.isLoading || carpetas.isLoading || notas.isLoading;

  const filas = useMemo((): Fila[] => {
    const plural = (n: number, uno: string, varios: string) => `y ${n} ${n === 1 ? uno : varios}`;
    return [
      ...(tareas.data?.items ?? [])
        .filter((t) => t.deletedAt !== null)
        .map((t): Fila => ({ clase: 'task', id: t.id, titulo: t.title, arrastre: null, deletedAt: t.deletedAt! })),
      ...(capitulos.data ?? []).map((p): Fila => ({
        clase: 'page',
        id: p.id,
        titulo: p.title ?? 'Sin título',
        arrastre: p.subpageCount > 0 ? plural(p.subpageCount, 'subcapítulo', 'subcapítulos') : null,
        deletedAt: p.deletedAt,
      })),
      ...(entidades.data ?? []).map((e): Fila => ({ clase: 'entity', id: e.id, titulo: e.name, arrastre: null, deletedAt: e.deletedAt })),
      ...(carpetas.data ?? []).map((f): Fila => ({
        clase: 'folder',
        id: f.id,
        titulo: f.name,
        arrastre: f.subfolderCount > 0 ? plural(f.subfolderCount, 'subcarpeta', 'subcarpetas') : null,
        deletedAt: f.deletedAt,
      })),
      ...(notas.data ?? []).map((n): Fila => ({
        clase: 'note',
        id: n.id,
        titulo: n.title ?? n.content ?? 'Nota sin texto',
        arrastre: null,
        deletedAt: n.deletedAt,
      })),
    ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }, [tareas.data, capitulos.data, entidades.data, carpetas.data, notas.data]);

  if (cargando) return <SheetLoading rows={3} />;
  if (filas.length === 0) {
    return (
      <EmptyState
        className="pl-(--margen)"
        title="No has borrado nada."
        description="Lo que borres espera aquí hasta que lo restaures."
      />
    );
  }
  return (
    <ul>
      {filas.map((fila) => (
        <TrashRow key={`${fila.clase}:${fila.id}`} fila={fila} onRestore={() => restaurar[fila.clase].mutate(fila.id)} />
      ))}
    </ul>
  );
}

function TrashRow({ fila, onRestore }: { fila: Fila; onRestore: () => void }) {
  const Icono = ICONO[fila.clase];
  return (
    // El hairline va en la fila de la lista: cada MarginRow es la última de su li.
    <li className="border-b border-border last:border-b-0">
      <MarginRow
        className="border-b-0"
        margin={<Icono aria-hidden className="mt-[0.5rem] size-5 stroke-[1.8]" />}
        trailing={
          <Button type="button" variant="ghost" size="sm" onClick={onRestore} className="text-foreground">
            <RotateCcw aria-hidden className="size-4" />
            Restaurar
          </Button>
        }
      >
        <span className="block truncate text-base leading-6 font-semibold text-foreground">{fila.titulo}</span>
        <span className="block truncate text-sm leading-5 text-muted-foreground">
          {ETIQUETA[fila.clase]}
          {fila.arrastre ? ` ${fila.arrastre}` : ''}, {fecha.format(new Date(fila.deletedAt))}
        </span>
      </MarginRow>
    </li>
  );
}
