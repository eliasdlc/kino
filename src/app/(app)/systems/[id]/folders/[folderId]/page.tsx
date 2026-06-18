import { auth } from "@/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Files } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import {
  getFolderById,
  getFolderBreadcrumb,
  getFolderChildren,
} from "@/features/folders/folders.service";
import { getSystembyId } from "@/features/systems/systems.service";
import { getPagesBySystem } from "@/features/pages/pages.service";
import { getTasksByFolder } from "@/features/tasks/tasks.service";
import { FolderCard } from "@/features/notebooks/FolderCard";
import { NotebookCard } from "@/features/notebooks/NotebookCard";
import { FolderViewToolbar } from "@/features/notebooks/FolderViewToolbar";

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

  const breadcrumbItems = [
    { label: "Sistemas", href: "/systems" },
    { label: system.name, href: `/systems/${systemId}` },
    ...breadcrumb.map((crumb) => ({
      label: crumb.name,
      href: `/systems/${systemId}/folders/${crumb.id}`,
    })),
    { label: folder.name },
  ];

  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 bg-background border-b px-4 md:px-6 py-2.5">
        <PageBreadcrumb items={breadcrumbItems} />
      </div>
      <div className="p-4 md:p-6 space-y-6">

      {/* Toolbar */}
      <FolderViewToolbar systemId={systemId} folderId={folderId} />

      {/* Documents section — folders + pages */}
      {!hasDocContent ? (
        <div className="rounded-lg border border-dashed p-10 text-center space-y-2">
          <Files className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Esta carpeta está vacía. Crea una subcarpeta o notebook para empezar.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {children.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {children.map((child) => (
                <FolderCard
                  key={child.id}
                  folder={child}
                  systemId={systemId}
                  href={`/systems/${systemId}/folders/${child.id}`}
                />
              ))}
            </div>
          )}
          {folderPages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {folderPages.map((page) => (
                <NotebookCard
                  key={page.id}
                  page={page}
                  systemId={systemId}
                  href={`/systems/${systemId}/pages/${page.id}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* Tasks assigned to this folder */}
      <TasksList
        systemId={systemId}
        initialData={[]}
        folderId={folderId}
        folderInitialData={folderTasks}
      />

      </div>
    </div>
  );
}
