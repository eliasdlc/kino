import type { SystemType } from "@/shared/lib/system-types";
import type { TaskCardProps } from "./types";
import { DefaultTaskCard } from "./DefaultTaskCard";
import { ProjectTaskCard } from "./ProjectTaskCard";
import { AcademicTaskCard } from "./AcademicTaskCard";
import { EntrepreneurialTaskCard } from "./EntrepreneurialTaskCard";
import { PersonalTaskCard } from "./PersonalTaskCard";

/**
 * Única fuente de verdad de "qué card dibuja cada systemType". Para darle una
 * vista propia a un tipo, creá su `*TaskCard` y agregalo a este switch. Los tipos
 * sin caso caen a `DefaultTaskCard` (la fila genérica del funnel).
 */
export function TaskCardFor({ systemType, ...props }: TaskCardProps & { systemType?: SystemType | null }) {
  switch (systemType) {
    case "project":
      return <ProjectTaskCard {...props} />;
    case "academic":
      return <AcademicTaskCard {...props} />;
    case "entrepreneurial":
      return <EntrepreneurialTaskCard {...props} />;
    case "personal":
      return <PersonalTaskCard {...props} />;
    default:
      return <DefaultTaskCard {...props} />;
  }
}
