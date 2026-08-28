"use client";

import { useState } from "react";
import { usePageEntities } from "./entities.hooks";
import { ENTITY_TYPE_ICON } from "./entities.ui";
import { EntityFicheSheet } from "./EntityFicheSheet";

/**
 * Las entidades del capítulo abierto, en una fila bajo el título (KIN-170).
 *
 * En escritorio el codex vive en el rail del panel derecho, y llegar a una ficha
 * desde ahí cuesta un click. En un teléfono ese mismo camino son tres capas
 * —abrir el panel, buscar en una lista larga, y una hoja que se abre encima de
 * otra— justo cuando estás escribiendo y no quieres perder el sitio.
 *
 * Aquí las mismas entidades y la misma ficha, a un toque y sin tapar el texto.
 * Es una fila que se desplaza en horizontal a propósito: son pocos elementos, el
 * gesto es el natural para una tira de fichas, y el texto de debajo no se mueve.
 *
 * No se pinta cuando no hay entidades: una fila vacía bajo el título sería
 * chrome que no dice nada.
 */
export function CodexChips({ pageId, systemId }: { pageId: string; systemId: string }) {
  const { data: entities = [] } = usePageEntities(pageId);
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  if (entities.length === 0) return null;

  return (
    <>
      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entities.map((e) => {
          const Icon = ENTITY_TYPE_ICON[e.type];
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setOpenEntityId(e.id)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-xs text-muted-foreground transition-colors active:bg-accent"
            >
              <Icon className="size-3 shrink-0" />
              <span className="max-w-32 truncate text-foreground">{e.name}</span>
            </button>
          );
        })}
      </div>

      <EntityFicheSheet
        entityId={openEntityId}
        systemId={systemId}
        open={openEntityId !== null}
        onOpenChange={(o) => !o && setOpenEntityId(null)}
      />
    </>
  );
}
