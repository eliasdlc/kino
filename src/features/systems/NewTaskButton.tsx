"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";

/**
 * Crear una tarea desde un sistema, con nombre. El disparador por defecto del
 * diálogo es un `+` suelto en el teléfono, y junto al `+` del pie no se sabía
 * si creaba una tarea, una vista o un ciclo: aquí el botón dice qué crea (en
 * el teléfono, a quien no ve la palabra) y el diálogo se abre controlado.
 */
export function NewTaskButton({ systemId, folderId }: { systemId: string; folderId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        className="w-fit shrink-0 max-md:px-2.5"
        aria-label="Nueva tarea en este sistema"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden className="size-4" />
        <span className="hidden md:inline">Nueva tarea</span>
      </Button>
      <CreateTaskDialog systemId={systemId} folderId={folderId} open={open} onOpenChange={setOpen} />
    </>
  );
}
