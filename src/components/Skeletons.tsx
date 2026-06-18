import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

/**
 * Breadcrumb skeleton — mirrors PageBreadcrumb's layout exactly.
 */
export function BreadcrumbSkeleton({ segments = 2 }: { segments?: number }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
      {Array.from({ length: segments }).map((_, i) => {
        const isLast = i === segments - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/30" />}
            <Skeleton
              className={`h-4 rounded bg-white/5 ${
                isLast ? "w-28 bg-white/10" : "w-16 bg-white/5"
              }`}
            />
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Task card skeleton — matches TaskCard's visual structure exactly.
 */
export function TaskCardSkeleton() {
  return (
    <div className="flex items-start gap-3.5 px-4 py-3.5 rounded-xl border bg-[#1a1a1e] border-white/[0.07] w-full">
      {/* Checkbox circle */}
      <div className="mt-0.5 size-6 shrink-0 rounded-full border-2 border-white/25 flex items-center justify-center">
        <Skeleton className="size-full rounded-full bg-white/5" />
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 mb-[5px]">
          <Skeleton className="h-5 w-2/3 rounded bg-white/10" />
        </div>
        {/* Meta badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type chip */}
          <Skeleton className="h-[22px] w-14 rounded-md bg-white/5" />
          {/* Status chip */}
          <Skeleton className="h-[22px] w-16 rounded-md bg-white/5" />
        </div>
      </div>
    </div>
  );
}

/**
 * Section card skeleton — matches the rounded-lg border bg-card p-6 pattern.
 */
export function CardSkeleton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-card p-6 space-y-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}

