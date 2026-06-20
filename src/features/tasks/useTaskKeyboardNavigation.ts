import { useState } from "react";
import { useHotkey } from "@/shared/hooks/useHotkey";
import type { Task } from "./tasks.types";

export function useTaskKeyboardNavigation(
  tasks: Task[],
  handlers: {
    onSelect?: (task: Task) => void;
    onToggle?: (taskId: string) => void;
    onDelete?: (task: Task) => void;
    onSelectionToggle?: (taskId: string) => void;
  },
  options?: {
    enabled?: boolean;
  }
) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const enabled = options?.enabled ?? true;

  // Clamp on read — avoids setState-in-effect and unnecessary re-renders
  const safeIndex = focusedIndex >= tasks.length ? tasks.length - 1 : focusedIndex;

  useHotkey(["j", "ArrowDown"], (e) => {
    e.preventDefault();
    setFocusedIndex((prev) => (prev < tasks.length - 1 ? prev + 1 : prev));
  }, { enabled });

  useHotkey(["k", "ArrowUp"], (e) => {
    e.preventDefault();
    setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, { enabled });

  useHotkey(["enter"], (e) => {
    if (safeIndex >= 0 && tasks[safeIndex]) {
      e.preventDefault();
      handlers.onSelect?.(tasks[safeIndex]);
    }
  }, { enabled });

  useHotkey([" ", "e"], (e) => {
    if (safeIndex >= 0 && tasks[safeIndex]) {
      e.preventDefault();
      handlers.onToggle?.(tasks[safeIndex].id);
    }
  }, { enabled });

  useHotkey(["backspace", "delete"], (e) => {
    if (safeIndex >= 0 && tasks[safeIndex]) {
      e.preventDefault();
      handlers.onDelete?.(tasks[safeIndex]);
    }
  }, { enabled });

  const selectionEnabled = enabled && !!handlers.onSelectionToggle;

  // x = toggle selection on focused task
  useHotkey("x", (e) => {
    if (safeIndex >= 0 && tasks[safeIndex]) {
      e.preventDefault();
      handlers.onSelectionToggle!(tasks[safeIndex].id);
    }
  }, { enabled: selectionEnabled });

  // shift+j = move focus down and add target to selection
  useHotkey("shift+j", (e) => {
    if (safeIndex < tasks.length - 1) {
      e.preventDefault();
      const nextIndex = safeIndex < 0 ? 0 : safeIndex + 1;
      handlers.onSelectionToggle!(tasks[nextIndex].id);
      setFocusedIndex(nextIndex);
    }
  }, { enabled: selectionEnabled });

  // shift+k = move focus up and add target to selection
  useHotkey("shift+k", (e) => {
    if (safeIndex > 0) {
      e.preventDefault();
      const prevIndex = safeIndex - 1;
      handlers.onSelectionToggle!(tasks[prevIndex].id);
      setFocusedIndex(prevIndex);
    }
  }, { enabled: selectionEnabled });

  return {
    focusedTaskId: tasks[safeIndex]?.id ?? null,
    setFocusedIndex,
  };
}
