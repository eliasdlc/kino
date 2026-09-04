import { useState } from "react";
import { differenceInCalendarDays, isBefore, startOfToday } from "date-fns";
import { parseDueDate } from "../tasks.utils";
import { useFolders } from "@/features/folders/folders.hooks";
import { getTaskTypeConfig } from "../task-type-config";
import { useFocusTimer } from "../FocusTimerProvider";
import { toast } from "sonner";
import type { TaskTransport } from "../tasks.types";
import type { FolderWithCounts } from "@/features/folders/folders.types";

export interface TaskCardState {
  isDone: boolean;
  isCritical: boolean;
  isHigh: boolean;
  isOverdue: boolean;
  isExpanded: boolean;
  completing: boolean;
  isThisRunning: boolean;
  anotherRunning: boolean;
  showPriorityBadge: boolean;
  dueDays: number | null;
  isDueSoon: boolean;
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
  const [completing, setCompleting] = useState(false);

  const { state: timerState, openModeDialog } = useFocusTimer();
  const isThisRunning = timerState.taskId === task.id && timerState.phase !== "idle";
  const anotherRunning = timerState.phase !== "idle" && !isThisRunning;

  const isDone = task.status === "done";
  const isCritical = task.priority === "critical" && !isDone;
  const isHigh = task.priority === "high" && !isDone;
  const isOverdue =
    !!task.dueDate &&
    !isDone &&
    isBefore(parseDueDate(task.dueDate), startOfToday());

  const { data: folders } = useFolders(systemId);
  const folder = task.folderId ? folders?.find((f) => f.id === task.folderId) : undefined;
  const typeConfig = getTaskTypeConfig(task.taskType, task.metadata);

  const showPriorityBadge = (isCritical || isHigh) && !isDone;

  const dueDays =
    task.dueDate && !isOverdue
      ? differenceInCalendarDays(parseDueDate(task.dueDate), startOfToday())
      : null;
  const isDueSoon = dueDays !== null && dueDays <= 2;

  const isExamOrQuiz =
    task.taskType === "event" &&
    ((task.metadata as Record<string, unknown>)?.eventSubtype === "exam" || (task.metadata as Record<string, unknown>)?.eventSubtype === "quiz");
  
  const isFutureEvent =
    isExamOrQuiz && task.startDate && isBefore(new Date(), new Date(task.startDate));

  function handleToggle() {
    
    if (!isDone && isFutureEvent) {
      toast.error("No puedes completar este evento antes de que suceda.");
      return;
    }

    if (!isDone) {
      setCompleting(true);
      setTimeout(() => setCompleting(false), 550);
    }
    onToggle(task.id);
  }

  return {
    isDone,
    isCritical,
    isHigh,
    isOverdue,
    isExpanded,
    completing,
    isThisRunning,
    anotherRunning,
    showPriorityBadge,
    dueDays,
    isDueSoon,
    folder,
    typeConfig,
    timerState,
    openModeDialog,
    setIsExpanded,
    handleToggle,
  };
}
