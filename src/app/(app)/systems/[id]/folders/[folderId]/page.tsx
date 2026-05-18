import { auth } from "@/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Files } from "lucide-react";
import {
  getFolderById,
  getFolderBreadcrumb,
  getFolderChildren,
} from "@/features/folders/folders.service";
import { getSystembyId } from "@/features/systems/systems.service";
import { getPagesBySystem } from "@/features/pages/pages.service";
import { getTasksByFolder } from "@/features/tasks/tasks.service";
import { FolderCard } from "@/features/docs/FolderCard";
import { PageCard } from "@/features/docs/PageCard";
import { FolderViewToolbar } from "@/features/docs/FolderViewToolbar";

import { TasksList } from "@/features/tasks/TasksList";
import { Separator } from "@/components/ui/separator";

interface FolderViewRouteProps {
  params: Promise<{ id: string; folderId: string }>;
}

export default async function FolderViewRoute({ params }: FolderViewRouteProps) {
  const { id: systemId, folderId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  const [folder, system] = await Promise.all([
    getFolderById(folderId, session.user.id),
    getSystembyId(systemId, session.user.id),
  ]);

  if (!folder || !system) notFound();

  const [children, allPages, breadcrumb, folderTasks] = await Promise.all([
    getFolderChildren(folderId, session.user.id),
    getPagesBySystem(systemId, session.user.id),
    getFolderBreadcrumb(folder.path, session.user.id),
    getTasksByFolder(folderId, systemId, session.user.id),
  ]);

  const folderPages = allPages.filter((p) => p.folderId === folderId);
  const hasDocContent = children.length > 0 || folderPages.length > 0;

  return (
    <div className="w-full space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
        <Link
          href={`/systems/${systemId}`}
          className="hover:text-foreground transition-colors"
        >
          {system.name}
        </Link>
        {breadcrumb.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            <Link
              href={`/systems/${systemId}/folders/${crumb.id}`}
              className="hover:text-foreground transition-colors"
            >
              {crumb.name}
            </Link>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <ChevronRight className="size-3.5" />
          <span className="text-foreground font-medium">{folder.name}</span>
        </span>
      </nav>

      {/* Toolbar */}
      <FolderViewToolbar systemId={systemId} folderId={folderId} />

      {/* Documents section — folders + pages */}
      {!hasDocContent ? (
        <div className="rounded-lg border border-dashed p-10 text-center space-y-2">
          <Files className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            This folder is empty. Create a subfolder or page to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {children.map((child) => (
            <FolderCard
              key={child.id}
              folder={child}
              systemId={systemId}
              href={`/systems/${systemId}/folders/${child.id}`}
            />
          ))}
          {folderPages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              href={`/systems/${systemId}/pages/${page.id}`}
            />
          ))}
        </div>
      )}

      <Separator />

      {/* Tasks assigned to this folder */}
      <TasksList
        systemId={systemId}
        initialData={folderTasks}
        folderId={folderId}
      />

    </div>
  );
}
