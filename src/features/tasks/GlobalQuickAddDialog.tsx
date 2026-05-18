"use client";

import { useState } from "react";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useSystems } from "@/features/systems/systems.hooks";
import { CreateTaskDialog } from "./CreateTaskDialog";

export function GlobalQuickAddDialog() {
  const [open, setOpen] = useState(false);
  const { data: systems } = useSystems();

  // Find the inbox system
  const inboxSystem = systems?.find((s) => s.isInbox);

  useHotkey(["mod+i"], (e) => {
    e.preventDefault();
    if (inboxSystem) {
      setOpen(true);
    }
  });

  if (!inboxSystem) return null;

  return (
    <CreateTaskDialog
      systemId={inboxSystem.id}
      open={open}
      onOpenChange={setOpen}
    />
  );
}
