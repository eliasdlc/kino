"use client";

import { Settings } from "lucide-react";
import { SystemPersonalView } from "./SystemPersonalView";
import type { SystemViewProps } from "./SystemDetailView";

export function SystemCustomView({ system, initialTasks }: SystemViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-muted/50 border border-border/60 text-sm text-muted-foreground">
        <Settings size={15} className="shrink-0" />
        Sistema personalizado — estados y vista configurables en Ajustes (próximamente).
      </div>
      <SystemPersonalView system={system} initialTasks={initialTasks} />
    </div>
  );
}
