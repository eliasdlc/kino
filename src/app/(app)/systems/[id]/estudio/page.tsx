import { auth } from "@/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { PageWrapper } from "@/components/PageWrapper";
import { getSystemById } from "@/features/systems/systems.service";
import { Studio } from "@/features/writing/Studio";

/** El estudio de escritura (KIN-143): qué escribir hoy, derivado de datos reales. */
export default async function StudioRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const system = await getSystemById(id, session.user.id);
  if (!system) notFound();

  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-2.5 md:px-6">
        <PageBreadcrumb
          items={[
            { label: "Sistemas", href: "/systems" },
            { label: system.name, href: `/systems/${id}?tab=docs` },
            { label: "Estudio" },
          ]}
        />
      </div>
      <PageWrapper className="w-full max-w-3xl">
        <div className="mb-5">
          <h1 className="text-xl font-semibold">Estudio — {system.name}</h1>
          <p className="text-sm text-muted-foreground">
            Lo que tus datos ya dicen sobre dónde seguir. Cada señal enseña de
            dónde sale.
          </p>
        </div>
        <Studio systemId={id} />
      </PageWrapper>
    </div>
  );
}
