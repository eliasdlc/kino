import { Folder } from "lucide-react";
import { getSystemColor } from "@/shared/utils/system-colors";
import type { FolderListItem } from "@/features/folders/folders.types";

interface FolderCardProps {
  folder: FolderListItem;
  // TODO(folder-navigation): Cuando exista la vista de contenido de carpeta,
  // cambiar onClick por un Link de Next.js hacia /systems/[systemId]/folders/[folder.id]
  // y eliminar este prop. Ver SystemTreeItem.tsx como referencia de la ruta.
  onClick?: () => void;
}

export function FolderCard({ folder, onClick }: FolderCardProps) {
  const colorClass = getSystemColor(folder.color).text;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent hover:border-accent-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full"
    >
      <Folder className={`size-7 ${colorClass}`} />
      <span className="text-sm font-medium truncate w-full leading-tight">
        {folder.name}
      </span>
    </button>
  );
}
