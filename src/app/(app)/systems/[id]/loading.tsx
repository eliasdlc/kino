import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { BreadcrumbSkeleton, TaskCardSkeleton } from "@/components/Skeletons";

export default function SystemLoading() {
  return (
    <div className="w-full">
      {/* Sticky breadcrumb */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-2.5">
        <BreadcrumbSkeleton segments={2} />
      </div>

      <PageWrapper className="w-full">
        {/* System header — mirrors SystemDetailHeader (tinted card, collapsible) */}
        <div className="rounded-lg bg-muted/30 px-4 py-3 w-full space-y-2.5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="size-4 rounded shrink-0" />
              <Skeleton className="size-3 rounded-full shrink-0" />
              <Skeleton className="h-7 w-48 rounded" />
            </div>
            <Skeleton className="size-9 rounded-md shrink-0" />
          </div>
          {/* Identity statement */}
          <Skeleton className="h-4 w-3/5 rounded ml-7" />
          {/* Metadata badges */}
          <div className="flex items-center gap-2 pl-7">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          {/* Stats row */}
          <div className="flex items-center gap-4 pl-7">
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        </div>

        {/* SystemDetailTabs container */}
        <div className="p-1 rounded-lg flex items-center h-10 w-full select-none mb-4">
          <div className="flex-1 h-full rounded-md flex items-center justify-center text-sm font-medium text-transparent">
            Tasks
          </div>
          <div className="flex-1 h-full rounded-md bg-transparent flex items-center justify-center text-sm font-medium text-transparent">
            Docs
          </div>
        </div>

        {/* TasksList inner Tabs & Button */}
        <div className="flex items-center justify-between mb-4">
          {/* Inner TabsList (w-fit) */}
          <div className="p-1 rounded-lg flex items-center h-10 w-[300px] select-none">
            <div className="flex-1 h-full rounded-md bg-transparent" />
            <div className="flex-1 h-full rounded-md bg-transparent" />
            {/* Action tab is default */}
            <div className="flex-1 h-full rounded-md" />
            <div className="flex-1 h-full rounded-md bg-transparent" />
          </div>
          {/* Create Task Button */}
          <Skeleton className="h-10 w-[120px] rounded-md" />
        </div>

        {/* Action View Loading State */}
        <div className="flex flex-col gap-4 w-full h-full">
          {/* Daily Progress Section */}
          <div className="space-y-3">
            <Skeleton className="h-7 w-48 rounded" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>

          {/* Energy Columns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full pt-2">
            {[
              { label: "Energía alta", desc: "Tareas que requieren mucho foco." },
              { label: "Energía media", desc: "Trabajo constante, foco moderado." },
              { label: "Energía baja", desc: "Tareas ligeras, fáciles de retomar." },
            ].map((col, idx) => (
              <div key={col.label} className="flex flex-col gap-2 min-w-0">
                <div className="space-y-1 mb-2 select-none">
                  <div className="font-semibold text-base text-transparent rounded w-max">
                    {col.label}
                  </div>
                  <div className="text-sm text-transparent rounded w-max">
                    {col.desc}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <TaskCardSkeleton />
                  {idx === 0 && <TaskCardSkeleton />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>
    </div>
  );
}
