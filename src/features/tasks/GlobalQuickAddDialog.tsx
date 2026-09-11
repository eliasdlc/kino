"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useSystems } from "@/features/systems/systems.hooks";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSystemColor } from "@/shared/utils/system-colors";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { useQuickAddStore } from "./quick-add.store";

/**
 * El diálogo de nueva tarea que el orbe, el atajo del teclado y el atajo del
 * icono comparten.
 *
 * El sistema destino es el Inbox **cuando existe**, y el primero de la lista
 * cuando no. Antes exigía Inbox y devolvía `null` sin él, así que en una cuenta
 * que no lo tiene el orbe se pintaba y no hacía nada, que es exactamente el
 * defecto del affordance muerto pero en el botón más visible del teléfono.
 */
export function GlobalQuickAddDialog() {
  const { open, setOpen } = useQuickAddStore();
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const { data: systems } = useSystems();

  const inboxSystem = systems?.find((s) => s.isInbox);
  const regularSystems = systems?.filter((s) => !s.isInbox) ?? [];
  const defaultSystem = inboxSystem ?? regularSystems[0];
  const targetSystemId = selectedSystemId ?? defaultSystem?.id ?? "";

  useHotkey(["mod+i"], (e) => {
    e.preventDefault();
    if (defaultSystem) setOpen(true);
  });

  // Sin ningún sistema no hay dónde crear la tarea, y entonces sí es correcto
  // no pintar nada: no hay destino que ofrecer.
  if (!defaultSystem) return null;

  return (
    <CreateTaskDialog
      systemId={targetSystemId}
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) setSelectedSystemId(null);
      }}
      header={
        <div className="space-y-1.5">
          <Label>Sistema</Label>
          <Select value={targetSystemId} onValueChange={setSelectedSystemId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {inboxSystem && (
                <SelectItem value={inboxSystem.id}>
                  <span className="flex items-center gap-2">
                    <Inbox size={12} />
                    {inboxSystem.name}
                  </span>
                </SelectItem>
              )}
              {regularSystems.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full inline-block bg-${getSystemColor(s.color)}`} />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    />
  );
}
