"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useDeleteSystem } from "./systems.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditSystemDialog } from "./EditSystemDialog";
import type { System } from "./systems.types";
import { SYSTEM_TYPE_CONFIG, type SystemType } from "@/shared/lib/system-types";
import { cn } from "@/lib/utils";

interface SystemDetailHeaderProps {
  system: System;
  taskCount: number;
}

export function SystemDetailHeader({ system, taskCount }: SystemDetailHeaderProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const { mutate: deleteSystem } = useDeleteSystem();
  const cls = getSystemColor(system.color);
  const typeConfig = SYSTEM_TYPE_CONFIG[(system.templateType ?? 'custom') as SystemType];
  const TypeIcon = typeConfig.icon;

  return (
    <div className="rounded-lg border bg-card p-4 md:p-6 space-y-3 md:space-y-4 w-full">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`size-3 rounded-full shrink-0 bg-${cls}`} />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
            {system.name}
          </h1>
          {system.isInbox && (
            <Badge variant="outline" className="shrink-0">Inbox</Badge>
          )}
          {!system.isActive && (
            <Badge variant="destructive" className="shrink-0">Inactive</Badge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 size-9">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {!system.isInbox && (
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                Edit system
              </DropdownMenuItem>
            )}
            {!system.isInbox && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive flex items-center gap-2"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete system
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Identity statement */}
      {system.identityStatement && (
        <p className="text-sm text-muted-foreground italic pl-6">
          &ldquo;{system.identityStatement}&rdquo;
        </p>
      )}

      {/* Type + metadata badges */}
      <div className="flex items-center gap-2 flex-wrap pl-6">
        <Badge variant="secondary" className="flex items-center gap-1.5">
          <TypeIcon className="size-3" />
          {typeConfig.label}
        </Badge>
        {system.energyIdeal && (
          <Badge variant="secondary">{system.energyIdeal}</Badge>
        )}
        {system.expectedFrequency && (
          <Badge variant="secondary">{system.expectedFrequency}</Badge>
        )}
      </div>

      {/* Trigger context — collapsible */}
      {system.triggerContext && (
        <div className="pl-6">
          <button
            onClick={() => setTriggerOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("size-3 transition-transform", triggerOpen && "rotate-180")} />
            <span className="font-medium">Contexto de activación</span>
          </button>
          {triggerOpen && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {system.triggerContext}
            </p>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 pl-6 pt-2 border-t text-xs text-muted-foreground">
        <span>{taskCount} task{taskCount !== 1 ? "s" : ""}</span>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete system"
        description={`"${system.name}" and all its content will be permanently deleted. This action cannot be undone.`}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteSystem(system.id, {
            onSuccess: () => router.push("/systems"),
          });
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <EditSystemDialog
        system={system}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
