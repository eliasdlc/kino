"use client";

import { useState } from "react";
import { useSystems, useDeleteSystem } from "./systems.hooks";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditSystemDialog } from "./EditSystemDialog";
import type { System } from "./systems.types";

const COLOR_BORDER: Record<string, string> = {
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

function SystemCardSkeleton() {
  return (
    <Card className="border-t-4 border-t-muted">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-2/3" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </CardContent>
    </Card>
  );
}

export function SystemsList() {
  const { data: systems, isLoading, isError } = useSystems();
  const { mutate: deleteSystem } = useDeleteSystem();
  const [editTarget, setEditTarget] = useState<System | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<System | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <SystemCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive font-medium">
          Error loading systems. Please try again.
        </p>
      </div>
    );
  }

  if (!systems || systems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          No systems yet. Create your first one to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {systems.filter((s) => !s.isInbox).map((system) => {
          const borderColor = COLOR_BORDER[system.color] ?? "border-t-gray-400";
          return (
            <Link key={system.id} href={`/systems/${system.id}`} className="group">
              <Card
                className={`border-t-4 ${borderColor} transition-all hover:shadow-md hover:-translate-y-0.5`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base group-hover:text-primary transition-colors">
                      {system.name}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/systems/${system.id}`} className="flex items-center gap-2">
                            <Eye className="size-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="flex items-center gap-2"
                          onClick={(e) => { e.preventDefault(); setEditTarget(system); }}
                        >
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive flex items-center gap-2"
                          onClick={(e) => { e.preventDefault(); setDeleteTarget(system); }}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[11px]">
                      {system.templateType}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {editTarget && (
        <EditSystemDialog
          system={editTarget}
          open={editTarget !== null}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete system"
        description={`"${deleteTarget?.name}" and all its content will be permanently deleted. This action cannot be undone.`}
        onConfirm={() => {
          if (deleteTarget) deleteSystem(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

