import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton, TaskCardSkeleton } from "@/components/skeletons";

export default function FolderLoading() {
  return (
    <div className="w-full">
      {/* Sticky breadcrumb */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-2.5">
        <BreadcrumbSkeleton segments={3} />
      </div>

      <div className="p-6 space-y-6">
        {/* Toolbar — buttons aligned left */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-md bg-white/5 border border-white/[0.08]" />
          <Skeleton className="h-9 w-24 rounded-md bg-white/5 border border-white/[0.08]" />
        </div>

        {/* Documents grid — matches grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-col items-start gap-2 rounded-lg border bg-card p-3 w-full"
            >
              {/* Folder/Page Icon */}
              <Skeleton className="size-7 rounded bg-white/5" />
              {/* Title */}
              <Skeleton className="h-4 w-3/4 rounded bg-white/10" />
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="border-t border-white/10 my-6" />

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

        {/* Action View Loading State */}
        <div className="flex flex-col gap-4 w-full h-full">
          {/* Daily Progress Section */}
          <div className="space-y-3">
            <Skeleton className="h-7 w-48 rounded bg-white/10" />
            <Skeleton className="h-2 w-full rounded-full bg-white/5" />
          </div>

          {/* Energy Columns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full pt-2">
            {[
              { label: "High Energy", desc: "Tasks requiring high focus." },
              { label: "Medium Energy", desc: "Steady work, moderate focus." },
              { label: "Low Energy", desc: "Light tasks, easy to pick up." },
            ].map((col, idx) => (
              <div key={col.label} className="flex flex-col gap-2 min-w-0">
                <div className="space-y-1 mb-2 select-none">
                  <div className="font-semibold text-base text-transparent bg-white/10 rounded w-max">
                    {col.label}
                  </div>
                  <div className="text-sm text-transparent bg-white/5 rounded w-max">
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
      </div>
    </div>
  );
}
