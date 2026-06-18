import { Button } from "@/components/ui/button";
import { FolderPlus, FilePlus } from "lucide-react";

interface NotebooksToolbarProps {
  onNewFolder?: () => void;
  onNewPage?: () => void;
}

export function NotebooksToolbar({ onNewFolder, onNewPage }: NotebooksToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewFolder}>
        <FolderPlus className="size-3.5" />
        Nueva carpeta
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewPage}>
        <FilePlus className="size-3.5" />
        Nuevo notebook
      </Button>
    </div>
  );
}
