"use client";

import { useState } from "react";
import { Link2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTasks } from "@/features/tasks/tasks.hooks";
import { useLinkedTasks, useLinkTask, useUnlinkTask } from "./pages.hooks";
import type { LinkedTask } from "./pages.types";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [open, setOpen] = useState(false);

  const linkedIds = new Set(linked.map((t) => t.id));
  const visibleLinked = linked.filter((t) => t.status !== "archived");
  const available = allTasks.filter((t) => !linkedIds.has(t.id) && t.status !== "archived");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="size-3.5" />
          Linked tasks
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
              <Plus className="size-3" />
              Link
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="end">
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                No tasks available to link
              </p>
            ) : (
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {available.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      linkTask(task.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
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
      </div>

      {isLoading && (
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {!isLoading && visibleLinked.length === 0 && (
        <p className="text-xs text-muted-foreground">No linked tasks yet.</p>
      )}

      {!isLoading && visibleLinked.length > 0 && (
        <div className="flex flex-col gap-1">
          {visibleLinked.map((task: LinkedTask) => (
            <div
              key={task.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm border bg-card"
            >
              <span className="flex-1 truncate">{task.title}</span>
              <Badge variant={STATUS_VARIANT[task.status] ?? "outline"} className="text-[11px] shrink-0">
                {task.status}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => unlinkTask(task.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Unlink task"
                    >
                      <X className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Unlink task</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
