import { auth } from "@/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSystembyId } from "@/features/systems/systems.service";
import { PageWrapper } from "@/components/PageWrapper";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { CodexLibrary } from "@/features/entities/CodexLibrary";

export default async function CodexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const system = await getSystembyId(id, session.user.id);
  if (!system) notFound();

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
        <CodexLibrary systemId={id} />
      </PageWrapper>
    </div>
  );
}
