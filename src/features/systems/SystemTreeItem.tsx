"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFolders, useCreateFolder } from "../folders/folders.hooks";
import { useSystemsTreeStore } from "./systems.store";
import { useDeleteSystem } from "./systems.hooks";
import { ICON_MAP, DEFAULT_ICON } from "./system-icons";
import { getSystemColor } from "@/shared/utils/system-colors";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { System } from "./systems.types";

interface SystemTreeItemProps {
  system: System;
  isActive: boolean;
  activeFolderId?: string;
}

export function SystemTreeItem({
  system,
  isActive,
  activeFolderId,
}: SystemTreeItemProps) {
  const isExpanded = useSystemsTreeStore((s) => s.expanded[system.id] ?? false);
  const toggle = useSystemsTreeStore((s) => s.toggle);
  const setExpanded = useSystemsTreeStore((s) => s.setExpanded);

  const { data: folders, isLoading: foldersLoading } = useFolders(system.id, {
    enabled: isExpanded,
  });

  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: createFolder, isPending } = useCreateFolder(system.id);
  const { mutate: deleteSystem } = useDeleteSystem();
  const router = useRouter();
  const pathname = usePathname();

  function handleConfirmDelete() {
    setConfirmDelete(false);
    deleteSystem(system.id, {
      onSuccess: () => {
        if (pathname.startsWith(`/systems/${system.id}`)) router.push("/systems");
      },
    });
  }

  useEffect(() => {
    if (isCreating) inputRef.current?.focus();
  }, [isCreating]);

  async function handleCreateFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setIsCreating(false);
      return;
    }
    try {
      await createFolder({ name: trimmed });
    } finally {
      setNewFolderName("");
      setIsCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleCreateFolder();
    if (e.key === "Escape") {
      setIsCreating(false);
      setNewFolderName("");
    }
  }

  function handleNewFolder() {
    if (!isExpanded) setExpanded(system.id, true);
    setIsCreating(true);
  }

  const Icon = ICON_MAP[system.icon] ?? DEFAULT_ICON;
  const color = getSystemColor(system.color).text;

  return (
    <div>
      {/* System row */}
      <div
        className={`group flex items-center gap-1 px-1.5 py-1.5 rounded-md text-sm transition-colors ${isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }`}
      >
        {/* Chevron */}
        <button
          onClick={() => toggle(system.id)}
          className="p-0.5 rounded hover:bg-sidebar-accent shrink-0"
        >
          <ChevronRight
            className={`size-3.5 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""
              }`}
          />
        </button>

        {/* System link */}
        <Link
          href={`/systems/${system.id}`}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <Icon className={`size-4 shrink-0 ${color}`} />
          <span className="truncate">{system.name}</span>
        </Link>

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-sidebar-accent shrink-0 transition-opacity">
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleNewFolder}>
              <FolderPlus className="size-4 mr-2" />
              New folder
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pencil className="size-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Collapsible folder list */}
      {isExpanded && (
        <div className="ml-5 border-l border-sidebar-border pl-2 mt-0.5 space-y-0.5">
          {/* Skeleton */}
          {foldersLoading && (
            <div className="space-y-1 py-1">
              {[0, 1].map((i) => (
                <div key={i} className="h-6 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {/* Folder links */}
          {!foldersLoading &&
            folders?.map((folder) => (
              <Link
                key={folder.id}
                href={`/systems/${system.id}/folders/${folder.id}`}
                className={`flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors ${activeFolderId === folder.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
              >
                <Folder className={`size-3.5 shrink-0 ${color}`} />
                <span className="truncate flex-1">{folder.name}</span>
              </Link>
            ))}

          {/* Empty state */}
          {!foldersLoading && (!folders || folders.length === 0) && !isCreating && (
            <p className="px-2 py-1 text-xs text-muted-foreground/60">
              No folders
            </p>
          )}

          {/* Inline folder creation input */}
          {isCreating && (
            <div className="flex items-center gap-2 px-2 py-1">
              <Folder className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (isPending) return;
                  if (!newFolderName.trim()) setIsCreating(false);
                }}
                placeholder="Folder name"
                className="flex-1 bg-transparent text-sm outline-none border-b border-sidebar-primary text-sidebar-foreground placeholder:text-muted-foreground/60"
              />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete system"
        description={`"${system.name}" and all its content will be permanently deleted.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
