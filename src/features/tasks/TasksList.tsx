"use client";

import { useState, type ComponentType } from "react";
import type { Task } from "./tasks.types";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskBacklogView } from "./TaskBacklogView";
import { TaskActionView } from "./TaskActionView";
import { TaskPlanningView } from "./TaskPlanningView";
import { TaskArchiveView } from "./TaskArchiveView";
import type { SystemTabId } from "@/shared/lib/system-types";

interface TasksListProps {
  systemId: string;
  initialData: Task[];
  /** When set, tasks are scoped to this folder (folder detail view) */
  folderId?: string;
  /** SSR-fetched folder tasks — seeds useFolderTasks immediately to avoid loading flash */
  folderInitialData?: Task[];
  /** Tabs to show, in order. Defaults to the full funnel. */
  visibleTabs?: SystemTabId[];
  /** Tab open on mount (the system's "headspace"). */
  defaultTab?: SystemTabId;
}

interface TabViewProps {
  systemId: string;
  initialData: Task[];
  folderId?: string;
  folderInitialData?: Task[];
  onEdit?: (task: Task) => void;
  keyboardDisabled?: boolean;
}

const TAB_META: Record<SystemTabId, { label: string; View: ComponentType<TabViewProps> }> = {
  backlog: { label: "Backlog", View: TaskBacklogView },
  planning: { label: "Planning", View: TaskPlanningView },
  action: { label: "Action", View: TaskActionView },
  archive: { label: "Archive", View: TaskArchiveView },
};

const DEFAULT_TABS: SystemTabId[] = ["backlog", "planning", "action", "archive"];

export function TasksList({
  systemId,
  initialData,
  folderId,
  folderInitialData,
  visibleTabs = DEFAULT_TABS,
  defaultTab,
}: TasksListProps) {
  const [editTask, setEditTask] = useState<Task | null>(null);

  const tabs = visibleTabs.length > 0 ? visibleTabs : DEFAULT_TABS;
  const initialTab = defaultTab && tabs.includes(defaultTab) ? defaultTab : tabs[0];

  return (
    <>
      <Tabs defaultValue={initialTab} className="w-full flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="overflow-x-auto flex-1 min-w-0">
            <TabsList className="w-max">
              {tabs.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {TAB_META[tab].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <CreateTaskDialog systemId={systemId} folderId={folderId} />
        </div>

        {tabs.map((tab) => {
          const { View } = TAB_META[tab];
          return (
            <TabsContent key={tab} value={tab}>
              <View
                systemId={systemId}
                initialData={initialData}
                folderId={folderId}
                folderInitialData={folderInitialData}
                onEdit={setEditTask}
                keyboardDisabled={editTask !== null}
              />
            </TabsContent>
          );
        })}
      </Tabs>

      <TaskDetailSheet
        task={editTask}
        systemId={systemId}
        open={editTask !== null}
        onOpenChange={(open) => { if (!open) setEditTask(null); }}
      />
    </>
  );
}
