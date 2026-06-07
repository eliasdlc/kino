import { auth } from "@/auth";
import { getSystembyId } from "@/features/systems/systems.service";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTasksBySystem } from "@/features/tasks/tasks.service";
import { PageWrapper } from "@/components/PageWrapper";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { SystemDetailHeader } from "@/features/systems/SystemDetailHeader";
import { SystemDetailTabs } from "@/features/systems/SystemDetailTabs";

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
        <SystemDetailHeader system={system} taskCount={tasks.length} />
        <SystemDetailTabs systemId={id} initialTasks={tasks} defaultTab={tab === "docs" ? "docs" : "tasks"} />
      </PageWrapper>
    </div>
  );
}
