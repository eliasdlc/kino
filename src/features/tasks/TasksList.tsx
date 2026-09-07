"use client";

import { useState, type ComponentType } from "react";
import type { TaskTransport } from "./tasks.types";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskBacklogView } from "./TaskBacklogView";
import { TaskKanbanView } from "./TaskKanbanView";
import { TaskPlanningView } from "./TaskPlanningView";
import { TaskArchiveView } from "./TaskArchiveView";
import { type SystemTabId, SYSTEM_TAB_LABELS, SYSTEM_TAB_SHORT_LABELS } from "@/shared/lib/system-types";

interface TasksListProps {
  systemId: string;
  initialData: TaskTransport[];
  /** When set, tasks are scoped to this folder (folder detail view) */
  folderId?: string;
  /** SSR-fetched folder tasks: seeds useFolderTasks immediately to avoid loading flash */
  folderInitialData?: TaskTransport[];
  /** Tabs to show, in order. Defaults to the full funnel. */
  visibleTabs?: SystemTabId[];
  /** Tab open on mount (the system's "headspace"). */
  defaultTab?: SystemTabId;
}

interface TabViewProps {
  systemId: string;
  initialData: TaskTransport[];
  folderId?: string;
  folderInitialData?: TaskTransport[];
  onEdit?: (task: TaskTransport) => void;
  keyboardDisabled?: boolean;
}

const TAB_META: Record<SystemTabId, { View: ComponentType<TabViewProps> }> = {
  backlog: { View: TaskBacklogView },
  planning: { View: TaskPlanningView },
  action: { View: TaskKanbanView },
  archive: { View: TaskArchiveView },
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
  const [editTask, setEditTask] = useState<TaskTransport | null>(null);

  const tabs = visibleTabs.length > 0 ? visibleTabs : DEFAULT_TABS;
  const initialTab = defaultTab && tabs.includes(defaultTab) ? defaultTab : tabs[0];

  return (
    <>
      <Tabs defaultValue={initialTab} className="w-full flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TabsList className="flex-1 min-w-0 md:flex-none md:w-max">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="min-w-0 px-2 text-xs md:px-3 md:text-sm">
                <span className="md:hidden">{SYSTEM_TAB_SHORT_LABELS[tab]}</span>
                <span className="hidden md:inline">{SYSTEM_TAB_LABELS[tab]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
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
