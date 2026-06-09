"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  MoreHorizontal,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { System } from "./systems.types";
import { SYSTEM_TYPE_CONFIG, type SystemType } from "@/shared/lib/system-types";

interface SystemTreeItemProps {
  system: System;
  isActive: boolean;
  activeFolderId?: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SystemTreeItem({
  system,
  isActive,
  activeFolderId,
  collapsed,
  onNavigate,
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

  const typeConfig = SYSTEM_TYPE_CONFIG[(system.templateType ?? 'custom') as SystemType];
  const Icon = ICON_MAP[system.icon ?? ''] ?? typeConfig?.icon ?? DEFAULT_ICON;
  const cls = getSystemColor(system.color);

  const { data: healthData } = useQuery<{ stale: boolean; daysSinceActivity: number | null }>({
    queryKey: ['system-health', system.id],
    queryFn: () => fetch(`/api/systems/${system.id}/health`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });
  const isStale = healthData?.stale ?? false;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/systems/${system.id}`}
            className={`flex justify-center p-2.5 rounded-md transition-colors ${isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
          >
            <Icon className={`size-5 shrink-0 text-${cls}`} />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{system.name}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      {/* System row */}
      <div
        className={`group flex items-center gap-1.5 px-2 py-2 rounded-md text-sm transition-colors ${isActive
          ? `bg-${cls}/10 text-sidebar-accent-foreground font-medium border-l-2 border-${cls}`
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }`}
      >
        {/* Chevron */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggle(system.id)}
                className="p-0.5 rounded hover:bg-sidebar-accent shrink-0"
              >
                <ChevronRight
                  className={`size-4 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""
                    }`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>{isExpanded ? "Collapse" : "Expand"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* System link */}
        <Link
          href={`/systems/${system.id}`}
          onClick={onNavigate}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <Icon className={`size-5 shrink-0 text-${cls}`} />
          <span className="truncate flex-1">{system.name}</span>
          {isStale && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="size-2 rounded-full bg-amber-500/80 shrink-0 inline-block" />
              </TooltipTrigger>
              <TooltipContent side="right">
                {healthData?.daysSinceActivity != null
                  ? `Sin actividad hace ${healthData.daysSinceActivity} días`
                  : 'Sin actividad reciente'}
              </TooltipContent>
            </Tooltip>
          )}
        </Link>

        {/* Context menu */}
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-sidebar-accent shrink-0 transition-opacity">
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>System options</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleNewFolder}>
              <FolderPlus className="size-5 mr-2" />
              New folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-5 mr-2" />
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
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${activeFolderId === folder.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
              >
                <Folder className={`size-4 shrink-0 text-${cls}`} />
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
              <Folder className="size-4 shrink-0 text-muted-foreground" />
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
