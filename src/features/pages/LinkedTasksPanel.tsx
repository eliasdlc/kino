"use client";

import { useState } from "react";
import { Link2, Plus } from "lucide-react";
import { api } from "@convex/_generated/api";
import { getConvexClient } from "@/shared/convex/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTasks } from "@/features/tasks/tasks.hooks";
import { useToggleTask } from "@/features/tasks/tasks.hooks";
import { useLinkedTasks, useLinkTask, useUnlinkTask } from "./pages.hooks";
import { LinkedTaskCard } from "./LinkedTaskCard";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { CreateTaskDialog } from "@/features/tasks/CreateTaskDialog";
import type { LinkedTaskTransport } from "./pages.types";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  backlog: "outline",
  week: "secondary",
  today: "default",
  done: "secondary",
  archived: "outline",
};

interface LinkedTasksPanelProps {
  pageId: string;
  systemId: string;
}

export function LinkedTasksPanel({ pageId, systemId }: LinkedTasksPanelProps) {
  const { data: linked = [], isLoading } = useLinkedTasks(pageId);
  const { data: allTasks = [] } = useTasks(systemId, []);
  const { mutate: linkTask } = useLinkTask(pageId);
  const { mutate: unlinkTask } = useUnlinkTask(pageId);
  const { mutate: toggleTask } = useToggleTask(systemId);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Full task data for the edit sheet: fetched on-demand when user clicks edit
  const [editTask, setEditTask] = useState<TaskTransport | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const linkedIds = new Set(linked.map((t) => t.id));
  const visibleLinked = linked;
  const available = allTasks.filter((t) => !linkedIds.has(t.id));

  // When user clicks edit on a linked task, fetch the full TaskTransport object
  async function handleEdit(linkedTask: LinkedTaskTransport) {
    try {
      setEditTask(await getConvexClient().query(api.tasks.byId, { id: linkedTask.id }));
      setEditSheetOpen(true);
    } catch {
      // Fallback: build a partial task from linked data to still open the sheet
      // This covers network issues: the sheet will still work for most fields
      setEditTask({
        ...linkedTask,
        userId: "",
        recurrenceRule: null,
        recurrenceParentId: null,
        externalSource: null,
        sortIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        deletedAt: null,
      } as TaskTransport);
      setEditSheetOpen(true);
    }
  }

  // Auto-link a newly created task to this page
  function handleTaskCreated(task: TaskTransport) {
    linkTask(task.id);
  }

  return (
    <div className="space-y-3">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="size-4" />
          Linked tasks
        </div>
        <div className="flex items-center gap-1">
          {/* Link existing task */}
          <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                <Plus className="size-3.5" />
                Link
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  No hay tareas disponibles para vincular
                </p>
              ) : (
                <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                  {available.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        linkTask(task.id);
                        setLinkPopoverOpen(false);
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded text-sm hover:bg-accent text-left"
                    >
                      <span className="flex-1 truncate">{task.title}</span>
                      <Badge variant={STATUS_VARIANT[task.status] ?? "outline"} className="text-[11px] shrink-0">
                        {task.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Create new task + auto-link */}
          <CreateTaskDialog
            systemId={systemId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onTaskCreated={handleTaskCreated}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
            New
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && visibleLinked.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-muted-foreground">Aún no hay tareas vinculadas.</p>
          <p className="text-xs text-muted-foreground/60">
            Link existing tasks or create new ones to track work related to this page.
          </p>
        </div>
      )}

      {/* TaskTransport cards */}
      {!isLoading && visibleLinked.length > 0 && (
        <div className="flex flex-col gap-2">
          {visibleLinked.map((task: LinkedTaskTransport) => (
            <LinkedTaskCard
              key={task.id}
              task={task}
              onToggle={() => toggleTask(task.id)}
              onEdit={() => handleEdit(task)}
              onUnlink={() => unlinkTask(task.id)}
            />
          ))}
        </div>
      )}

      {/* TaskTransport detail sheet: opens when editing a linked task */}
      <TaskDetailSheet
        task={editTask}
        systemId={systemId}
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) setEditTask(null);
        }}
      />
    </div>
  );
}
