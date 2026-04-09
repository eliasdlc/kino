"use client";

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
import { MoreHorizontal, Pencil, Trash2, Power } from "lucide-react";
import { useDeleteSystem } from "./systems.hooks";
import type { System } from "./systems.types";

const COLOR_ACCENT: Record<string, string> = {
  blue: "border-t-blue-500",
  red: "border-t-red-500",
  green: "border-t-green-500",
  yellow: "border-t-yellow-500",
  purple: "border-t-purple-500",
  pink: "border-t-pink-500",
  orange: "border-t-orange-500",
  teal: "border-t-teal-500",
  gray: "border-t-gray-500",
  black: "border-t-gray-900",
  white: "border-t-gray-300",
  cyan: "border-t-cyan-500",
};

const COLOR_DOT: Record<string, string> = {
  blue: "bg-blue-500",
  red: "bg-red-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  gray: "bg-gray-500",
  black: "bg-gray-900",
  white: "bg-gray-300",
  cyan: "bg-cyan-500",
};

interface SystemDetailHeaderProps {
  system: System;
  taskCount: number;
}

/**
 * Hero-style header for the system detail view.
 * Shows system name, identity statement, metadata badges, and stats.
 */
export function SystemDetailHeader({ system, taskCount }: SystemDetailHeaderProps) {
  const router = useRouter();
  const { mutate: deleteSystem } = useDeleteSystem();
  const borderColor = COLOR_ACCENT[system.color] ?? "border-t-gray-400";
  const dotColor = COLOR_DOT[system.color] ?? "bg-gray-400";

  function handleDelete() {
    if (!window.confirm(`¿Eliminar el sistema "${system.name}"? Esta acción no se puede deshacer.`)) return;
    deleteSystem(system.id, {
      onSuccess: () => router.push("/systems"),
    });
  }

  return (
    <div
      className={`rounded-lg border border-t-4 ${borderColor} bg-card p-6 space-y-4 w-full`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`size-3 rounded-full shrink-0 ${dotColor}`} />
          <h1 className="text-2xl font-bold tracking-tight truncate">
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
            <Button variant="outline" size="icon" className="shrink-0">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem className="flex items-center gap-2">
              <Pencil className="size-4" />
              Edit system
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2">
              <Power className="size-4" />
              {system.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive flex items-center gap-2"
              onClick={handleDelete}
              disabled={system.isInbox}
            >
              <Trash2 className="size-4" />
              Delete system
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Identity statement */}
      {system.identityStatement && (
        <p className="text-sm text-muted-foreground italic pl-6">
          &ldquo;{system.identityStatement}&rdquo;
        </p>
      )}

      {/* Metadata badges */}
      <div className="flex items-center gap-2 flex-wrap pl-6">
        {system.templateType && (
          <Badge variant="secondary">{system.templateType}</Badge>
        )}
        {system.energyIdeal && (
          <Badge variant="secondary">{system.energyIdeal}</Badge>
        )}
        {system.expectedFrequency && (
          <Badge variant="secondary">{system.expectedFrequency}</Badge>
        )}
      </div>

      {/* Trigger context */}
      {system.triggerContext && (
        <div className="pl-6">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Trigger:</span> {system.triggerContext}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 pl-6 pt-2 border-t text-xs text-muted-foreground">
        <span>{taskCount} task{taskCount !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}
