import { PageWrapper } from "@/components/PageWrapper";

export default function TasksPage() {
  return (
    <PageWrapper>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">All Tasks</h1>
        <p className="text-sm text-muted-foreground">
          A cross-system view of all your tasks. Coming soon.
        </p>
      </div>
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          This view will show all tasks across all systems, filterable by status, priority, and energy level.
        </p>
      </div>
    </PageWrapper>
  );
}