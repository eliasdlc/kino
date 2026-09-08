'use client';

import { useMemo } from 'react';
import { Box, FileText, Folder, ListTodo, RotateCcw, StickyNote } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Skeleton } from '@/components/ui/skeleton';
import { useConvexMutation, useConvexQuery } from '@/shared/convex/hooks';

/**
 * La papelera de la cuenta, con las cinco clases que se borran blando: tareas,
 * capítulos, entidades, carpetas y notas adhesivas. Una sola lista ordenada
 * por cuándo se borró, porque la pregunta que trae a alguien aquí es «qué
 * borré hace un rato», no «qué carpetas tengo borradas».
 *
 * Lo que se fue en cascada no se lista aparte: una subcarpeta o una nota que
 * cayó con su carpeta vuelve con ella, y la fila lo dice para que restaurar no
 * sea una sorpresa.
 */

const fecha = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' });

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Papelera</h2>
        <p className="text-sm text-muted-foreground">
          Lo que borraste sigue aquí hasta que lo restaures: tareas, capítulos, entidades, carpetas
          y notas adhesivas. Restaurar una carpeta o un capítulo devuelve también lo que se fue con
          él.
        </p>
      </div>

      {cargando ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : filas.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm">No has borrado nada.</p>
      ) : (
        <ul className="rounded-lg border divide-y">
          {filas.map((fila) => (
            <TrashRow key={`${fila.clase}:${fila.id}`} fila={fila} onRestore={() => restaurar[fila.clase].mutate(fila.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TrashRow({ fila, onRestore }: { fila: Fila; onRestore: () => void }) {
  const Icono = ICONO[fila.clase];
  return (
    <li className="flex items-center justify-between gap-4 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icono className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{fila.titulo}</p>
          <p className="truncate text-xs text-muted-foreground">
            {ETIQUETA[fila.clase]}
            {fila.arrastre ? ` ${fila.arrastre}` : ''} · {fecha.format(new Date(fila.deletedAt))}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRestore}
        className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <RotateCcw className="size-3.5 shrink-0" />
        Restaurar
      </button>
    </li>
  );
}
