import { notFound, redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { PageWrapper } from "@/components/PageWrapper";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { CodexLibrary } from "@/features/entities/CodexLibrary";
import { CodexNav } from "@/features/entities/CodexNav";
import { UniverseGraphLazy } from "@/features/entities/UniverseGraphLazy";
import { LooseThreads } from "@/features/writing/LooseThreads";
import { InWorldTimeline } from "@/features/writing/InWorldTimeline";
import { resolveCodexView } from "@/features/entities/codex.views";
import { getServerSession } from "@/shared/utils/session";

export default async function CodexPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view: rawView } = await searchParams;
  const session = await getServerSession();
  if (!session) redirect("/login");

  const system = await serverQuery(api.systems.byId, { id }).catch(() => null);
  if (!system) notFound();

  const view = resolveCodexView(rawView);

  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 bg-background border-b px-4 md:px-6 py-2.5">
        <PageBreadcrumb
          items={[
            { label: "Sistemas", href: "/systems" },
            { label: system.name, href: `/systems/${id}?tab=docs` },
            { label: "Codex" },
          ]}
        />
      </div>
      <PageWrapper className="w-full">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Codex — {system.name}</h1>
          <p className="text-sm text-muted-foreground">
            El universo de tu historia: personajes, lugares, objetos y todo lo que
            crece desde el texto.
          </p>
        </div>

        <CodexNav systemId={id} current={view} />

        <div className="mt-5">
          {view === "grafo" ? (
            <UniverseGraphLazy systemId={id} />
          ) : view === "hilos" ? (
            <LooseThreads system={system} />
          ) : view === "cronologia" ? (
            <InWorldTimeline systemId={id} />
          ) : (
            <CodexLibrary systemId={id} />
          )}
        </div>
      </PageWrapper>
    </div>
  );
}
