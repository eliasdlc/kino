"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilePlus, Loader2 } from "lucide-react";
import { useCreatePage } from "./pages.hooks";

interface CreatePageDialogProps {
  systemId: string;
  folderId?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreatePageDialog({
  systemId,
  folderId,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreatePageDialogProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [title, setTitle] = useState("");

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? setUncontrolledOpen) : setUncontrolledOpen;

  const { mutateAsync: createPage, isPending } = useCreatePage(systemId);

  async function handleCreate() {
    const page = await createPage({ title: title.trim() || undefined, folderId });
    setOpen(false);
    setTitle("");
    router.push(`/systems/${systemId}/pages/${page.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline" className="gap-1.5">
              <FilePlus className="size-3.5" />
              New page
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New page</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="page-title">Title (optional)</Label>
            <Input
              id="page-title"
              autoFocus
              placeholder="Untitled"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              maxLength={500}
            />
          </div>
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
            {isPending ? "Creating..." : "Create page"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
