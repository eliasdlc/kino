"use client";

import type { Task } from "./tasks.types";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { CircleCheckBig } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskActionView } from "./TaskActionView";
import { TaskPlanningView } from "./TaskPlanningView";
import { TaskArchiveView } from "./TaskArchiveView";

interface TasksListProps {
  systemId: string;
  initialData: Task[];
}

export function TasksList({ systemId, initialData }: TasksListProps) {
  return (
    <Tabs defaultValue="action" className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <CircleCheckBig className="size-8" />
          <h2 className="text-3xl font-extrabold">Tareas</h2>
          <TabsList>
            <TabsTrigger value="planning">Planning</TabsTrigger>
            <TabsTrigger value="action">Action</TabsTrigger>
            <TabsTrigger value="archive">Archive</TabsTrigger>
          </TabsList>
        </div>
        <CreateTaskDialog systemId={systemId} />
      </div>

      <TabsContent value="planning"><TaskPlanningView /></TabsContent>
      <TabsContent value="action">
        <TaskActionView systemId={systemId} initialData={initialData} />
      </TabsContent>
      <TabsContent value="archive"><TaskArchiveView /></TabsContent>
    </Tabs>
  );
}