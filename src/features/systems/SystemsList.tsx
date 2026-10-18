"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useSystems, useDeleteSystem } from "./systems.hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowsSkeleton } from "@/components/Skeletons";
import { EditSystemDialog } from "./EditSystemDialog";
import { SystemRow } from "./SystemRow";
import { CreateSystemDialog } from "./CreateSystemDialog";
import type { SystemTransport } from "./systems.types";

/** Con más sistemas que éstos, el índice ofrece buscar; con menos, el campo sería ruido. */
export const BUSCAR_DESDE = 6;

/**
 * Los sistemas como índice: la Bandeja primero y debajo cada sistema, una fila
 * por sistema con su glifo en el margen. Sin caja alrededor: una página tiene
 * renglones, no tarjetas.
 */
export function SystemsList() {
  const { data: systems, isLoading, isError } = useSystems();
  const { mutate: deleteSystem } = useDeleteSystem();
  const [editTarget, setEditTarget] = useState<SystemTransport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemTransport | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return (
      <div aria-busy aria-label="Cargando los sistemas">
        <RowsSkeleton rows={5} margin="numeral" />
      </div>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="pl-(--margen) text-sm text-destructive">
        No se pudieron cargar los sistemas. Recarga la página para intentarlo otra vez.
      </p>
    );
  }

  const inbox = systems?.find((s) => s.isInbox) ?? null;
  const own = (systems ?? []).filter((s) => !s.isInbox);
  const query = searchQuery.trim().toLowerCase();
  const filtered = query ? own.filter((s) => s.name.toLowerCase().includes(query)) : own;

  return (
    <div className="space-y-4">
      {own.length >= BUSCAR_DESDE && (
        <div className="relative max-w-sm pl-(--margen) md:pl-0">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-[calc(var(--margen)+1rem)] size-4 -translate-y-1/2 text-muted-foreground md:left-4"
          />
          <Input
            type="search"
            className="pl-11"
            placeholder="Buscar sistemas"
            aria-label="Buscar sistemas"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      <div>
        {inbox && !query && <SystemRow system={inbox} />}
        {filtered.map((system) => (
          <SystemRow
            key={system.id}
            system={system}
            onEdit={() => setEditTarget(system)}
            onDelete={() => setDeleteTarget(system)}
          />
        ))}
      </div>

      {own.length === 0 && (
        <EmptyState
          className="pl-(--margen)"
          title="Todavía no tienes sistemas"
          description="Un sistema es una parte de tu vida que quieres sostener: la universidad, una novela, la salud."
          action={<CreateSystemDialog trigger={<Button>Crear sistema</Button>} />}
        />
      )}

      {own.length > 0 && filtered.length === 0 && (
        <p className="flex flex-wrap items-center gap-x-2 pl-(--margen) text-sm text-muted-foreground">
          <span>{`Ningún sistema se llama "${searchQuery.trim()}".`}</span>
          <Button variant="link" size="sm" className="px-1" onClick={() => setSearchQuery("")}>
            Limpiar
          </Button>
        </p>
      )}

      {editTarget && (
        <EditSystemDialog
          system={editTarget}
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar sistema"
        description={`"${deleteTarget?.name}" y todo su contenido se eliminarán para siempre. No se puede deshacer.`}
        onConfirm={() => {
          if (deleteTarget) deleteSystem(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
