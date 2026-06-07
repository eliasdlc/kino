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

export function GlobalQuickAddDialog() {
  const { open, setOpen } = useQuickAddStore();
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const { data: systems } = useSystems();

  const inboxSystem = systems?.find((s) => s.isInbox);
  const regularSystems = systems?.filter((s) => !s.isInbox) ?? [];
  const targetSystemId = selectedSystemId ?? inboxSystem?.id ?? "";

  useHotkey(["mod+i"], (e) => {
    e.preventDefault();
    if (inboxSystem) setOpen(true);
  });

  if (!inboxSystem) return null;

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
          <Label>System</Label>
          <Select value={targetSystemId} onValueChange={setSelectedSystemId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={inboxSystem.id}>
                <span className="flex items-center gap-2">
                  <Inbox size={12} />
                  {inboxSystem.name}
                </span>
              </SelectItem>
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
