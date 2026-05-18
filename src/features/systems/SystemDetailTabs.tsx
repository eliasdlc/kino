"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TasksList } from "@/features/tasks/TasksList";
import { DocsView } from "@/features/docs/DocsView";
import type { Task } from "@/features/tasks/tasks.types";

interface SystemDetailTabsProps {
  systemId: string;
  initialTasks: Task[];
  defaultTab?: "tasks" | "docs";
}

export function SystemDetailTabs({ systemId, initialTasks, defaultTab = "tasks" }: SystemDetailTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
        <TabsTrigger value="docs">Docs</TabsTrigger>
      </TabsList>

      <TabsContent value="tasks" className="mt-4">
        <TasksList systemId={systemId} initialData={initialTasks} />
      </TabsContent>

      <TabsContent value="docs" className="mt-4">
        <DocsView systemId={systemId} />
      </TabsContent>
    </Tabs>
  );
}
