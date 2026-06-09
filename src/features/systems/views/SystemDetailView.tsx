"use client";

import type { ComponentType } from "react";
import type { System } from "@/features/systems/systems.types";
import type { Task } from "@/features/tasks/tasks.types";
import type { SystemType } from "@/shared/lib/system-types";
import { SystemAcademicView } from "./SystemAcademicView";
import { SystemProfessionalView } from "./SystemProfessionalView";
import { SystemEntrepreneurialView } from "./SystemEntrepreneurialView";
import { SystemPersonalView } from "./SystemPersonalView";
import { SystemCustomView } from "./SystemCustomView";

export interface SystemViewProps {
  system: System;
  initialTasks: Task[];
}

const VIEW_MAP: Record<SystemType, ComponentType<SystemViewProps>> = {
  academic: SystemAcademicView,
  professional: SystemProfessionalView,
  entrepreneurial: SystemEntrepreneurialView,
  personal: SystemPersonalView,
  custom: SystemCustomView,
  inbox: SystemPersonalView,
};

export function SystemDetailView({ system, initialTasks }: SystemViewProps) {
  const systemType = (system.templateType ?? "custom") as SystemType;
  const View = VIEW_MAP[systemType] ?? SystemPersonalView;
  return <View system={system} initialTasks={initialTasks} />;
}
