import { useState, useEffect } from "react";
import { useHotkey } from "@/shared/hooks/useHotkey";
import type { Task } from "./tasks.types";

export function useTaskKeyboardNavigation(
  tasks: Task[],
  handlers: {
    onSelect?: (task: Task) => void;
    onToggle?: (taskId: string) => void;
    onDelete?: (task: Task) => void;
  },
  options?: {
    enabled?: boolean;
  }
) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const enabled = options?.enabled ?? true;

  // Reset focus if tasks array shrinks below focused index
  useEffect(() => {
    if (focusedIndex >= tasks.length) {
      setFocusedIndex(tasks.length - 1);
    }
  }, [tasks.length, focusedIndex]);

  useHotkey(["j", "ArrowDown"], (e) => {
    e.preventDefault();
    setFocusedIndex((prev) => (prev < tasks.length - 1 ? prev + 1 : prev));
  }, { enabled });

  useHotkey(["k", "ArrowUp"], (e) => {
    e.preventDefault();
    setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, { enabled });

  useHotkey(["enter"], (e) => {
    if (focusedIndex >= 0 && tasks[focusedIndex]) {
      e.preventDefault();
      handlers.onSelect?.(tasks[focusedIndex]);
    }
  }, { enabled });

  useHotkey([" ", "e"], (e) => {
    if (focusedIndex >= 0 && tasks[focusedIndex]) {
      e.preventDefault();
      handlers.onToggle?.(tasks[focusedIndex].id);
    }
  }, { enabled });

  useHotkey(["backspace", "delete"], (e) => {
    if (focusedIndex >= 0 && tasks[focusedIndex]) {
      e.preventDefault();
      handlers.onDelete?.(tasks[focusedIndex]);
    }
  }, { enabled });

  return { 
    focusedTaskId: tasks[focusedIndex]?.id ?? null,
    setFocusedIndex
  };
}
