"use client";

import type { SystemTransport } from "@/features/systems/systems.types";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { SystemType } from "@/shared/lib/system-types";
import { resolveSystemManifest } from "@/shared/lib/system-manifest";
import { TasksList } from "@/features/tasks/TasksList";
import { SystemAcademicView } from "./SystemAcademicView";
import { SystemProjectView } from "./SystemProjectView";
import { SystemEntrepreneurialView } from "./SystemEntrepreneurialView";
import { SystemCustomView } from "./SystemCustomView";
import { SystemWritingView } from "./SystemWritingView";
import { InboxView } from "./InboxView";
import { PersonalView } from "./PersonalView";

export interface SystemViewProps {
  system: SystemTransport;
  initialTasks: TaskTransport[];
}

/**
 * Manda un sistema a su vista. Los seis arquetipos elegibles tienen la suya;
 * `custom` es el único que deja al usuario componer sus tabs.
 */
export function SystemDetailView({ system, initialTasks }: SystemViewProps) {
  const systemType = (system.templateType ?? "custom") as SystemType;

  if (systemType === "academic") {
    return <SystemAcademicView system={system} initialTasks={initialTasks} />;
  }
  if (systemType === "project") {
    return <SystemProjectView system={system} initialTasks={initialTasks} />;
  }
  if (systemType === "entrepreneurial") {
    return <SystemEntrepreneurialView system={system} initialTasks={initialTasks} />;
  }
  if (systemType === "writing") {
    return <SystemWritingView system={system} initialTasks={initialTasks} />;
  }
  if (systemType === "personal") {
    return <PersonalView system={system} initialTasks={initialTasks} />;
  }
  if (systemType === "inbox") {
    return <InboxView system={system} initialTasks={initialTasks} />;
  }
  if (systemType === "custom") {
    return <SystemCustomView system={system} initialTasks={initialTasks} />;
  }

  // Un `templateType` que el manifiesto no conoce: el funnel universal desde el
  // preset, que es lo único que se puede montar sin saber de qué habla.
  const config = resolveSystemManifest(system);
  return (
    <TasksList
      systemId={system.id}
      initialData={initialTasks}
      visibleTabs={config.tabs}
      defaultTab={config.defaultTab}
    />
  );
}
