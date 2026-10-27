import { useState } from "react";
import { differenceInCalendarDays, isBefore, startOfToday } from "date-fns";
import { isFutureExamOrQuiz, parseDueDate } from "../tasks.utils";
import { useFolders } from "@/features/folders/folders.hooks";
import { getTaskTypeConfig } from "../task-type-config";
import { useFocusTimer } from "../FocusTimerProvider";
import { toast } from "sonner";
import type { TaskTransport } from "../tasks.types";
import type { FolderWithCounts } from "@/features/folders/folders.types";

export interface TaskCardState {
  isDone: boolean;
  isExpanded: boolean;
  isThisRunning: boolean;
  anotherRunning: boolean;
  dueDays: number | null;
  folder: FolderWithCounts | undefined;
  typeConfig: ReturnType<typeof getTaskTypeConfig>;
  timerState: ReturnType<typeof useFocusTimer>["state"];
  openModeDialog: ReturnType<typeof useFocusTimer>["openModeDialog"];
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  handleToggle: () => void;
}

export function useTaskCard(
  task: TaskTransport,
  systemId: string,
  onToggle: (taskId: string) => void,
): TaskCardState {
  const [isExpanded, setIsExpanded] = useState(false);

  const { state: timerState, openModeDialog } = useFocusTimer();
  const isThisRunning = timerState.taskId === task.id && timerState.phase !== "idle";
  const anotherRunning = timerState.phase !== "idle" && !isThisRunning;

  const isDone = task.status === "done";
  const isOverdue =
    !!task.dueDate &&
    !isDone &&
    isBefore(parseDueDate(task.dueDate), startOfToday());

  const { data: folders } = useFolders(systemId);
  const folder = task.folderId ? folders?.find((f) => f.id === task.folderId) : undefined;
  const typeConfig = getTaskTypeConfig(task.taskType, task.metadata);

  const dueDays =
    task.dueDate && !isOverdue
      ? differenceInCalendarDays(parseDueDate(task.dueDate), startOfToday())
      : null;

  function handleToggle() {
    if (!isDone && isFutureExamOrQuiz(task)) {
      toast.error("No puedes completar este evento antes de que suceda.");
      return;
    }

    onToggle(task.id);
  }

  return {
    isDone,
    isExpanded,
    isThisRunning,
    anotherRunning,
    dueDays,
    folder,
    typeConfig,
    timerState,
    openModeDialog,
    setIsExpanded,
    handleToggle,
  };
}
