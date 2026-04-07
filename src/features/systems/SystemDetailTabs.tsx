"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TasksList } from "@/features/tasks/TasksList";
import { PagesList } from "@/features/pages/PagesList";
import { FoldersList } from "@/features/folders/FoldersList";
import type { Task } from "@/features/tasks/tasks.types";

interface SystemDetailTabsProps {
  systemId: string;
  initialTasks: Task[];
}

/**
 * Tabbed content for system detail view.
 * Avoids the long vertical scroll of all three sections stacked.
 */
export function SystemDetailTabs({ systemId, initialTasks }: SystemDetailTabsProps) {
  return (
    <Tabs defaultValue="tasks" className="w-full">
      <TabsList>
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
        <TabsTrigger value="pages">Pages</TabsTrigger>
        <TabsTrigger value="folders">Folders</TabsTrigger>
      </TabsList>

      <TabsContent value="tasks" className="mt-4">
        <TasksList systemId={systemId} initialData={initialTasks} />
      </TabsContent>

      <TabsContent value="pages" className="mt-4">
        <PagesList />
      </TabsContent>

      <TabsContent value="folders" className="mt-4">
        <FoldersList />
      </TabsContent>
    </Tabs>
  );
}
