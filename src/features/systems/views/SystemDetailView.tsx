"use client";

import type { System } from "@/features/systems/systems.types";
import type { Task } from "@/features/tasks/tasks.types";
import { SYSTEM_TYPE_CONFIG, type SystemType } from "@/shared/lib/system-types";
import { TasksList } from "@/features/tasks/TasksList";
import { SystemAcademicView } from "./SystemAcademicView";
import { SystemProjectView } from "./SystemProjectView";
import { SystemEntrepreneurialView } from "./SystemEntrepreneurialView";
import { SystemCustomView } from "./SystemCustomView";
import { SystemWritingView } from "./SystemWritingView";

export interface SystemViewProps {
  system: System;
  initialTasks: Task[];
}

/**
 * Routes a system to its view. inbox/personal montan el funnel universal
 * componible desde su preset; custom deja al usuario elegir tabs; los demás
 * tipos conservan su vista dedicada hasta la Fase 3.
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
  if (systemType === "custom") {
    return <SystemCustomView system={system} initialTasks={initialTasks} />;
  }

  // inbox + personal → funnel universal desde el preset
  const config = SYSTEM_TYPE_CONFIG[systemType] ?? SYSTEM_TYPE_CONFIG.personal;
  return (
    <TasksList
      systemId={system.id}
      initialData={initialTasks}
      visibleTabs={config.tabs}
      defaultTab={config.defaultTab}
    />
  );
}
