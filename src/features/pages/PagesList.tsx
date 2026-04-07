import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";

export function PagesList() {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pages</h2>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" />
          New Page
        </Button>
      </div>

      {/* Empty state */}
      <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
        <FileText className="size-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">
          No pages yet. Create one to start writing.
        </p>
      </div>
    </div>
  );
}