import { notFound, redirect } from "next/navigation";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { ReadingView } from "@/features/writing/ReadingView";
import { getServerSession } from "@/shared/utils/session";

/**
 * Modo lectura de una obra (KIN-138). Server component: el manuscrito entero se
 * resuelve de una vez y llega renderizado: leer no necesita ni un fetch del
 * cliente ni estado de servidor que invalidar.
 */
export default async function ReadingRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; folderId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id: systemId, folderId } = await params;
  const { print } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const [manuscript, system] = await Promise.all([
    serverQuery(api.writing.manuscript, { id: folderId }).catch(() => null),
    serverQuery(api.systems.byId, { id: systemId }).catch(() => null),
  ]);

  if (!manuscript || !system) notFound();

  return (
    <div className="w-full">
      <div className="reading-no-print sticky top-0 z-10 border-b bg-background px-4 py-2.5 md:px-6">
        <PageBreadcrumb
          items={[
            { label: "Sistemas", href: "/systems" },
            { label: system.name, href: `/systems/${systemId}?tab=docs` },
            {
              label: manuscript.title,
              href: `/systems/${systemId}/folders/${folderId}`,
            },
            { label: "Lectura" },
          ]}
        />
      </div>
      <div className="p-4 md:p-8">
        <ReadingView manuscript={manuscript} autoPrint={print === "1"} />
      </div>
    </div>
  );
}
