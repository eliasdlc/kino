"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
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
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <ResponsiveDialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline" className="gap-1.5">
              <FilePlus className="size-3.5" />
              Nueva página
            </Button>
          )}
        </ResponsiveDialogTrigger>
      )}
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Nueva página</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="flex flex-col gap-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="page-title">Título (opcional)</Label>
            <Input
              id="page-title"
              autoFocus
              placeholder="Sin título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              maxLength={500}
            />
          </div>
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
            {isPending ? "Creando..." : "Crear página"}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
