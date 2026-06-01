import { PageHeader, PageWrapper } from "@/components/PageWrapper";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { AllTasksList } from "./AllTasksList";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function TasksPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) return redirect("/login");

    return (
      <PageWrapper>
        <PageHeader
          title="Tasks"
          description="All your tasks, in one place."
          actions={<CreateTaskDialog systemId="all-tasks" />}
        />
  
        <AllTasksList />
      </PageWrapper>
    );
  }