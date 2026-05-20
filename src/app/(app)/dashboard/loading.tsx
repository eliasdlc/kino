import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { cn } from "@/lib/utils";

export default function DashboardLoading() {
  return (
    <PageWrapper>
      {/* Greeting */}
      <div className="space-y-1">
        <Skeleton className="h-9 w-64 rounded bg-white/10" />
        <Skeleton className="h-4 w-48 rounded bg-white/5 mt-1" />
      </div>

      {/* Smart View — what to do now */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-transparent bg-white/5 rounded w-16 h-6 animate-pulse" />
            <Skeleton className="h-3.5 w-24 rounded bg-white/5 mt-1" />
          </div>
          <Skeleton className="h-5 w-10 rounded bg-white/5" />
        </div>

        {/* Progress bar */}
        <Skeleton className="h-1.5 w-full rounded-full bg-white/5" />

        {/* Task rows */}
        <ul className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border",
                i === 1
                  ? "border-emerald-500/10 bg-emerald-500/[0.02]"
                  : "border-transparent"
              )}
            >
              {/* Priority icon placeholder */}
              <Skeleton className="size-3.5 rounded shrink-0 bg-white/10" />
              {/* Title placeholder */}
              <Skeleton className={`h-4 rounded flex-1 bg-white/10 ${i === 1 ? "max-w-[50%]" : i === 2 ? "max-w-[40%]" : "max-w-[45%]"}`} />
              {/* Energy dot placeholder */}
              <Skeleton className="size-1.5 rounded-full shrink-0 bg-white/5" />
            </li>
          ))}
        </ul>
      </div>

      {/* Quick links */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="text-lg font-semibold text-transparent bg-white/5 rounded w-28 h-6 animate-pulse" />
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm"
            >
              <Skeleton className={`h-4 rounded bg-white/10 ${i === 1 ? "w-32" : i === 2 ? "w-24" : "w-36"}`} />
              <Skeleton className="size-4 rounded shrink-0 bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}

