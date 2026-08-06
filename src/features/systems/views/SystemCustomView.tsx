"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TasksList } from "@/features/tasks/TasksList";
import { resolveSystemManifest } from "@/shared/lib/system-manifest";
import { ComposeSystemDialog } from "../ComposeSystemDialog";
import { useLiveSystem } from "../systems.hooks";
import type { SystemViewProps } from "./SystemDetailView";

/**
 * Custom es el arquetipo sin opiniones: lo que otros traen en su manifiesto,
 * aquí lo pone el usuario desde "Componer" (D16). Todo lo que se ve —tabs,
 * vocabulario, clases de tarea— sale del manifiesto ya resuelto con esa
 * composición, no de constantes de este archivo.
 */
export function SystemCustomView({ system: initialSystem, initialTasks }: SystemViewProps) {
  const [composeOpen, setComposeOpen] = useState(false);
  const system = useLiveSystem(initialSystem);
  const manifest = resolveSystemManifest(system);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setComposeOpen(true)}>
          <SlidersHorizontal className="size-4" />
          Componer
        </Button>
      </div>

      <TasksList
        key={manifest.tabs.join(",") + manifest.defaultTab}
        systemId={system.id}
        initialData={initialTasks}
        visibleTabs={manifest.tabs}
        defaultTab={manifest.defaultTab}
      />

      {/* La key remonta el formulario cuando la composición guardada cambia: sin
          ella el diálogo seguiría mostrando el estado con que se montó. */}
      <ComposeSystemDialog
        key={JSON.stringify(system.metadata?.composition ?? {})}
        system={system}
        open={composeOpen}
        onOpenChange={setComposeOpen}
      />
    </div>
  );
}
