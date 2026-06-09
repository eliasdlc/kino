import { auth } from "@/auth";
import { getSystembyId } from "@/features/systems/systems.service";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTasksBySystem } from "@/features/tasks/tasks.service";
import { PageWrapper } from "@/components/PageWrapper";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { SystemDetailHeader } from "@/features/systems/SystemDetailHeader";
import { computeSystemSignals } from "@/features/systems/systems.signals";
import { SystemDetailView } from "@/features/systems/views/SystemDetailView";
import { DocsView } from "@/features/docs/DocsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SystemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  const system = await getSystembyId(id, session.user.id);
  const tasks = await getTasksBySystem(id, session.user.id);

  if (!system) notFound();

  const signals = computeSystemSignals(system, tasks);

  return (
    <div className="w-full">
      <div className="sticky top-14 md:top-0 z-10 bg-background border-b px-4 md:px-6 py-2.5">
        <PageBreadcrumb
          items={[
            { label: "Systems", href: "/systems" },
            { label: system.name },
          ]}
        />
      </div>
      <PageWrapper className="w-full">
        <SystemDetailHeader system={system} signals={signals} />

        <Tabs defaultValue={tab === "docs" ? "docs" : "tasks"} className="w-full mt-4">
          <TabsList>
            <TabsTrigger value="tasks">Tareas</TabsTrigger>
            <TabsTrigger value="docs">Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            <SystemDetailView system={system} initialTasks={tasks} />
          </TabsContent>

          <TabsContent value="docs" className="mt-4">
            <DocsView systemId={id} />
          </TabsContent>
        </Tabs>
      </PageWrapper>
    </div>
  );
}
