import { auth } from "@/auth";
import { getSystembyId } from "@/features/systems/systems.service";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTasksBySystem } from "@/features/tasks/tasks.service";
import { TasksList } from "@/features/tasks/TasksList";
import { PagesList } from "@/features/pages/PagesList";
import { FoldersList } from "@/features/folders/FoldersList";

export default async function SystemPage({ params }: { params: Promise<{ id: string }> }) {

    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) redirect("/login");

    const system = await getSystembyId(id, session.user.id);

    const tasks = await getTasksBySystem(id, session.user.id);

    return (
        <div className="p-4 flex flex-col gap-6 w-full h-full">
            <h1 className="text-3xl font-bold">{system.name}</h1>
            <div className="flex flex-col gap-6">
                <TasksList systemId={id} initialData={tasks} />
                <PagesList />
                <FoldersList />
            </div>
        </div>
    )
}    