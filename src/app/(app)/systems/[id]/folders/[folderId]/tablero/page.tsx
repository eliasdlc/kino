import { notFound, redirect } from "next/navigation";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { PageWrapper } from "@/components/PageWrapper";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { PlotGridView } from "@/features/writing/PlotGridView";
import { getServerSession } from "@/shared/utils/session";

/** Tablero de escenas de una obra (KIN-141). */
export default async function PlotBoardRoute({
  params,
}: {
  params: Promise<{ id: string; folderId: string }>;
}) {
  const { id: systemId, folderId } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const [folder, system] = await Promise.all([
    serverQuery(api.folders.detail, { id: folderId }).catch(() => null),
    serverQuery(api.systems.byId, { id: systemId }).catch(() => null),
  ]);

  if (!folder || !system) notFound();

  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-2.5 md:px-6">
        <PageBreadcrumb
          items={[
            { label: "Sistemas", href: "/systems" },
            { label: system.name, href: `/systems/${systemId}?tab=docs` },
            { label: folder.name, href: `/systems/${systemId}/folders/${folderId}` },
            { label: "Tablero" },
          ]}
        />
      </div>
      <PageWrapper className="w-full">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Tablero — {folder.name}</h1>
          <p className="text-sm text-muted-foreground">
            Las escenas de la obra por capítulo y arco narrativo.
          </p>
        </div>
        <PlotGridView systemId={systemId} folderId={folderId} />
      </PageWrapper>
    </div>
  );
}
