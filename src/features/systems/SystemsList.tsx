"use client";

import { useState } from "react";
import { useSystems, useDeleteSystem } from "./systems.hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditSystemDialog } from "./EditSystemDialog";
import { SystemCard } from "./SystemCard";
import { CreateSystemDialog } from "./CreateSystemDialog";
import { Button } from "@/components/ui/button";
import type { SystemTransport } from "./systems.types";

function SystemRowSkeleton() {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3 px-4 py-3">
      <Skeleton className="size-2.5 rounded-full" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/** Los sistemas como una lista de filas dentro de una superficie. */
export function SystemsList() {
  const { data: systems, isLoading, isError } = useSystems();
  const { mutate: deleteSystem } = useDeleteSystem();
  const [editTarget, setEditTarget] = useState<SystemTransport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemTransport | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return (
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {[...Array(4)].map((_, i) => (
          <SystemRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        No se pudieron cargar los sistemas. Vuelve a intentarlo.
      </div>
    );
  }

  if (!systems || systems.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground/80">
        <span className="min-w-0 flex-1">Aún no tienes sistemas. Crea el primero para empezar.</span>
        <CreateSystemDialog trigger={<Button size="sm">Crear sistema</Button>} />
      </div>
    );
  }

  const filteredSystems = systems.filter(
    (s) => !s.isInbox && s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-11"
          placeholder="Buscar sistemas"
          aria-label="Buscar sistemas"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredSystems.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground/80">
          <span className="min-w-0 flex-1">Ningún sistema se llama &quot;{searchQuery}&quot;.</span>
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setSearchQuery("")}>
            Limpiar
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
          {filteredSystems.map((system) => (
            <SystemCard
              key={system.id}
              system={system}
              onEdit={() => setEditTarget(system)}
              onDelete={() => setDeleteTarget(system)}
            />
          ))}
        </div>
      )}

      {editTarget && (
        <EditSystemDialog
          system={editTarget}
          open={editTarget !== null}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
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
