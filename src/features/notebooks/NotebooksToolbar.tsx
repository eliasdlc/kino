import { Button } from "@/components/ui/button";
import { FolderPlus, FilePlus } from "lucide-react";

interface NotebooksToolbarProps {
  onNewFolder?: () => void;
  onNewPage?: () => void;
  /** CTA de contenedor; `null` en arquetipos que no ofrecen carpetas. */
  newFolderLabel?: string | null;
  /** CTA de página, con el sustantivo del arquetipo ("Nuevo apunte"). */
  newPageLabel?: string;
}

export function NotebooksToolbar({
  onNewFolder,
  onNewPage,
  newFolderLabel = "Nueva carpeta",
  newPageLabel = "Nuevo notebook",
}: NotebooksToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {newFolderLabel && (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewFolder}>
          <FolderPlus className="size-3.5" />
          {newFolderLabel}
        </Button>
      )}
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewPage}>
        <FilePlus className="size-3.5" />
        {newPageLabel}
      </Button>
    </div>
  );
}
