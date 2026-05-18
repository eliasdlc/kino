import { auth } from "@/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getPageById, getPagesBySystem } from "@/features/pages/pages.service";
import { getSystembyId } from "@/features/systems/systems.service";
import { PageEditor } from "@/features/pages/PageEditor";
import { LinkedTasksPanel } from "@/features/pages/LinkedTasksPanel";
import { StickyNotesGrid } from "@/features/sticky-notes/StickyNotesGrid";
import { Separator } from "@/components/ui/separator";

interface PageEditorRouteProps {
  params: Promise<{ id: string; pageId: string }>;
}

export default async function PageEditorRoute({ params }: PageEditorRouteProps) {
  const { id: systemId, pageId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  const [page, system, allPages] = await Promise.all([
    getPageById(pageId, session.user.id),
    getSystembyId(systemId, session.user.id),
    getPagesBySystem(systemId, session.user.id),
  ]);

  if (!page || !system) notFound();

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Main editor area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          <Link
            href={`/systems/${systemId}?tab=docs`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-4" />
            {system.name}
          </Link>
          <StickyNotesGrid pageId={pageId} />
          <PageEditor key={page.id} page={page} systemId={systemId} />
        </div>
      </div>

      {/* Right sidebar */}
      <div className="hidden md:block w-72 border-l bg-card/50 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Page info
            </p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>System: {system.name}</p>
              {page.updatedAt && (
                <p>Updated: {new Date(page.updatedAt).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          <Separator />

          {allPages.length > 1 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Pages
              </p>
              <div className="space-y-0.5">
                {allPages.map((p) => (
                  <Link
                    key={p.id}
                    href={`/systems/${systemId}/pages/${p.id}`}
                    className={`block px-2 py-1.5 rounded text-xs transition-colors truncate ${
                      p.id === pageId
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    {p.title ?? "Untitled"}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <LinkedTasksPanel pageId={pageId} systemId={systemId} />
        </div>
      </div>
    </div>
  );
}
