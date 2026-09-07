import { cn } from "@/lib/utils";
import { useSubtasks } from "../../tasks.hooks";

/**
 * Barras segmentadas de progreso de subtareas (una por subtarea, activa = hecha),
 * como en el mockup del board. Carga las subtareas por task (no vienen en la lista
 * del sistema, que filtra `parentTaskId`). Render "Sin subtareas" cuando no hay.
 */
export function SubtaskProgressBars({ taskId, systemId }: { taskId: string; systemId: string }) {
  const { data: subtasks } = useSubtasks(taskId, systemId);

  if (!subtasks || subtasks.length === 0) {
    return <span className="text-[13px] text-muted-foreground">Sin subtareas</span>;
  }

  const done = subtasks.filter((s) => s.status === "done").length;

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-[2px]">
        {subtasks.map((s, i) => (
          <div
            key={s.id ?? i}
            className={cn("w-[2.5px] h-3.5 rounded-sm", i < done ? "bg-secondary dark:bg-[#3c5deb]" : "bg-muted-foreground/25")}
          />
        ))}
      </div>
      <div className="text-[13px] font-semibold text-muted-foreground">
        <span className="text-foreground">{done}</span> / {subtasks.length}
      </div>
    </div>
  );
}
