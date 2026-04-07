import { Button } from "@/components/ui/button";
import { FolderOpen, Plus } from "lucide-react";

export function FoldersList() {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Folders</h2>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" />
          New Folder
        </Button>
      </div>

      {/* Empty state */}
      <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
        <FolderOpen className="size-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">
          No folders yet. Create one to organize your pages.
        </p>
      </div>
    </div>
  );
}