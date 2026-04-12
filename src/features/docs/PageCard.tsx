import { FileText } from "lucide-react";
import type { PageListItem } from "./docs.types";

// TODO(pages-types): Cuando pages.types.ts exista, cambiar el import de arriba por:
// import type { PageListItem } from "@/features/pages/pages.types";

interface PageCardProps {
  page: PageListItem;
  // TODO(page-editor): Cuando exista la vista/editor de página, cambiar onClick
  // por un Link de Next.js hacia /systems/[systemId]/pages/[page.id]
  // y eliminar este prop.
  onClick?: () => void;
}

export function PageCard({ page, onClick }: PageCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent hover:border-accent-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full"
    >
      <FileText className="size-7 text-muted-foreground" />
      <span className="text-sm font-medium truncate w-full leading-tight">
        {page.title ?? <span className="italic text-muted-foreground">Sin título</span>}
      </span>
    </button>
  );
}
