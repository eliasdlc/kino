import { Button } from "@/components/ui/button";
import { FolderPlus, FilePlus } from "lucide-react";

interface DocsToolbarProps {
  // TODO(create-folder): Conectar con CreateFolderDialog.
  // En DocsView, agregar: const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  // y pasar onNewFolder={() => setFolderDialogOpen(true)}
  onNewFolder?: () => void;
  // TODO(create-page): Conectar con CreatePageDialog.
  // En DocsView, agregar: const [pageDialogOpen, setPageDialogOpen] = useState(false)
  // y pasar onNewPage={() => setPageDialogOpen(true)}
  onNewPage?: () => void;
}

export function DocsToolbar({ onNewFolder, onNewPage }: DocsToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewFolder}>
        <FolderPlus className="size-3.5" />
        New folder
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewPage}>
        <FilePlus className="size-3.5" />
        New page
      </Button>
    </div>
  );
}
