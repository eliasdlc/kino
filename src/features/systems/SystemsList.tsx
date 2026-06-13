"use client";

import { useState } from "react";
import { useSystems, useDeleteSystem } from "./systems.hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditSystemDialog } from "./EditSystemDialog";
import { SystemCard } from "./SystemCard";
import type { System } from "./systems.types";

function SystemCardSkeleton() {
  return (
    <Skeleton className="mx-auto aspect-square w-full max-w-[260px] rounded-[28px]" />
  );
}

export function SystemsList() {
  const { data: systems, isLoading, isError } = useSystems();
  const { mutate: deleteSystem } = useDeleteSystem();
  const [editTarget, setEditTarget] = useState<System | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<System | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => (
          <SystemCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive font-medium">
          Error loading systems. Please try again.
        </p>
      </div>
    );
  }

  if (!systems || systems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Aún no tienes sistemas. Crea el primero para empezar.
        </p>
      </div>
    );
  }

  const filteredSystems = systems.filter(
    (s) => !s.isInbox && s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search systems..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredSystems.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No systems found matching &quot;{searchQuery}&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
        description={`"${deleteTarget?.name}" and all its content will be permanently deleted. This action cannot be undone.`}
        onConfirm={() => {
          if (deleteTarget) deleteSystem(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
