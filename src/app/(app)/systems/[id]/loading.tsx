import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { BreadcrumbSkeleton, CardSkeleton, TaskCardSkeleton } from "@/components/skeletons";

export default function SystemLoading() {
  return (
    <div className="w-full">
      {/* Sticky breadcrumb */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-2.5">
        <BreadcrumbSkeleton segments={2} />
      </div>

      <PageWrapper className="w-full">
        {/* System header card — mirrors SystemDetailHeader */}
        <CardSkeleton>
          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="size-3 rounded-full shrink-0" />
              <Skeleton className="h-7 w-48 rounded" />
            </div>
            <Skeleton className="size-10 rounded-md shrink-0" />
          </div>
          {/* Identity statement */}
          <Skeleton className="h-4 w-3/5 rounded ml-6" />
          {/* Metadata badges */}
          <div className="flex items-center gap-2 pl-6">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          {/* Stats row */}
          <div className="flex items-center gap-4 pl-6 pt-2 border-t">
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        </CardSkeleton>

        {/* SystemDetailTabs container */}
        <div className="bg-white/[0.04] p-1 rounded-lg flex items-center h-10 w-full select-none mb-4">
          <div className="flex-1 h-full rounded-md bg-white/[0.08] flex items-center justify-center text-sm font-medium text-transparent">
            Tasks
          </div>
          <div className="flex-1 h-full rounded-md bg-transparent flex items-center justify-center text-sm font-medium text-transparent">
            Docs
          </div>
        </div>

        {/* TasksList inner Tabs & Button */}
        <div className="flex items-center justify-between mb-4">
          {/* Inner TabsList (w-fit) */}
          <div className="bg-white/[0.04] p-1 rounded-lg flex items-center h-10 w-[300px] select-none">
            <div className="flex-1 h-full rounded-md bg-transparent" />
            <div className="flex-1 h-full rounded-md bg-transparent" />
            {/* Action tab is default */}
            <div className="flex-1 h-full rounded-md bg-white/[0.08]" />
            <div className="flex-1 h-full rounded-md bg-transparent" />
          </div>
          {/* Create Task Button */}
          <Skeleton className="h-10 w-[120px] rounded-md bg-white/10" />
        </div>

        {/* Task cards */}
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      </PageWrapper>
    </div>
  );
}
