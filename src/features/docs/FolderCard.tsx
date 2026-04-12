import { Folder } from "lucide-react";
import type { FolderListItem } from "@/features/folders/folders.types";

const COLOR_MAP: Record<string, string> = {
  blue: "text-blue-500",
  red: "text-red-500",
  green: "text-green-500",
  yellow: "text-yellow-500",
  purple: "text-purple-500",
  pink: "text-pink-500",
  orange: "text-orange-500",
  cyan: "text-cyan-500",
  teal: "text-teal-500",
  gray: "text-gray-500",
  black: "text-gray-900",
  white: "text-gray-200",
};

interface FolderCardProps {
  folder: FolderListItem;
  // TODO(folder-navigation): Cuando exista la vista de contenido de carpeta,
  // cambiar onClick por un Link de Next.js hacia /systems/[systemId]/folders/[folder.id]
  // y eliminar este prop. Ver SystemTreeItem.tsx como referencia de la ruta.
  onClick?: () => void;
}

export function FolderCard({ folder, onClick }: FolderCardProps) {
  const colorClass = COLOR_MAP[folder.color] ?? "text-gray-400";

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
