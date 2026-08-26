"use client";

import { useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useBulkMove } from "./tasks.hooks";
import type { TaskTransport } from "./tasks.types";
import { type TaskStatus } from "./tasks.state-machine";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CascadeInboxModeProps {
  tasks: TaskTransport[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SLOT_BTN =
  "flex-1 text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent/60 transition-colors font-medium";

export function CascadeInboxMode({ tasks, open, onOpenChange }: CascadeInboxModeProps) {
  const [index, setIndex] = useState(0);
  const { mutate: bulkMove } = useBulkMove();

  const task = tasks[index];
  const total = tasks.length;
  const done = index;

  function advance() {
    if (index < total - 1) setIndex((i) => i + 1);
    else onOpenChange(false);
  }

  function schedule(status: TaskStatus) {
    if (!task) return;
    bulkMove({ taskIds: [task.id], status }, { onSuccess: advance });
  }

  // Keyboard shortcuts (only when dialog is open)
  useHotkey("h", () => schedule("today"), { enabled: open });
  useHotkey("m", () => schedule("tomorrow"), { enabled: open });
  useHotkey("s", () => schedule("week"), { enabled: open });
  useHotkey("c", () => schedule("done"), { enabled: open });
  useHotkey(["n", "ArrowRight"], () => advance(), { enabled: open });

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-medium text-muted-foreground">
              Vaciando inbox · {done}/{total}
            </DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>

        {/* TaskTransport */}
        <div className="py-4 border rounded-xl px-4 bg-card">
          <p className="text-base font-medium text-foreground">{task.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {task.status} · {task.priority ?? "sin prioridad"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => schedule("today")} className={SLOT_BTN}>
            <span className="text-muted-foreground mr-1 font-mono">[H]</span> Hoy
          </button>
          <button onClick={() => schedule("tomorrow")} className={SLOT_BTN}>
            <span className="text-muted-foreground mr-1 font-mono">[M]</span> Mañana
          </button>
          <button onClick={() => schedule("week")} className={SLOT_BTN}>
            <span className="text-muted-foreground mr-1 font-mono">[S]</span> Semana
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => schedule("done")}
            className={cn(SLOT_BTN, "hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400")}
          >
            <span className="text-muted-foreground mr-1 font-mono">[C]</span> Completar
          </button>
          <button
            onClick={advance}
            className={cn(SLOT_BTN, "flex items-center justify-center gap-1")}
          >
            <span className="text-muted-foreground mr-1 font-mono">[N]</span>
            Saltar
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
