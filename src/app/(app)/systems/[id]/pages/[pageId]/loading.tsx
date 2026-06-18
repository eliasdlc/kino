import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbSkeleton } from "@/components/Skeletons";

export default function PageEditorLoading() {
  return (
    <div className="flex h-screen overflow-hidden flex-col">
      {/* Sticky breadcrumb */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-2.5 shrink-0">
        <BreadcrumbSkeleton segments={3} />
      </div>

      {/* Editor + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main editor area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            {/* Sticky Notes Section placeholder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between select-none">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <span className="size-4 shrink-0 rounded bg-white/5" />
                  Sticky notes
                </div>
                <Skeleton className="h-7 w-12 rounded bg-white/5" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg bg-white/5" />
                ))}
              </div>
            </div>

            {/* Page Title & Editor lines */}
            <div className="space-y-4 pt-2">
              <Skeleton className="h-9 w-2/3 rounded-md bg-white/10" />
              <div className="space-y-3 pt-2">
                <Skeleton className="h-4 w-full rounded bg-white/5" />
                <Skeleton className="h-4 w-[92%] rounded bg-white/5" />
                <Skeleton className="h-4 w-[85%] rounded bg-white/5" />
                <Skeleton className="h-4 w-full rounded bg-white/5" />
                <Skeleton className="h-4 w-[78%] rounded bg-white/5" />
                <Skeleton className="h-4 w-[90%] rounded bg-white/5" />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="hidden md:block w-72 border-l bg-card/50 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Page info section */}
            <div className="space-y-3 select-none">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Page info
              </p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <Skeleton className="h-3 w-32 rounded bg-white/5" />
                <Skeleton className="h-3 w-28 rounded bg-white/5" />
              </div>
            </div>

            <Separator />

            {/* Pages list section */}
            <div className="space-y-2 select-none">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pages
              </p>
              <div className="space-y-0.5">
                <Skeleton className="h-7 w-full rounded bg-white/10" />
                <Skeleton className="h-7 w-[95%] rounded bg-white/5" />
                <Skeleton className="h-7 w-[90%] rounded bg-white/5" />
              </div>
            </div>

            <Separator />

            {/* Linked tasks section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between select-none">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="size-4 shrink-0 rounded bg-white/5" />
                  Linked tasks
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-8 w-12 rounded bg-white/5" />
                  <Skeleton className="h-8 w-12 rounded bg-white/5" />
                </div>
              </div>
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg bg-white/5" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
