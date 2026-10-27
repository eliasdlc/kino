import type { TaskTransport } from "../tasks.types";

/**
 * Contrato común de toda task card. Cada systemType puede tener su propio layout
 * (ver mockup del board en `ProjectTaskCard`), pero todos consumen estas props y
 * el hook `useTaskCard`, así son intercambiables vía `TaskCardFor`.
 */
export interface TaskCardProps {
  task: TaskTransport;
  systemId: string;
  draggable?: boolean;
  isFocused?: boolean;
  /** Tachada en esta visita: la lista que la pinta la deja en su sitio hasta la siguiente. */
  struck?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (task: TaskTransport) => void;
  onEdit?: (task: TaskTransport) => void;
}
