import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <Skeleton className="h-8 w-40 rounded" />
      {[1, 2, 3].map((section) => (
        <div key={section} className="rounded-xl border bg-card">
          <div className="px-4 py-3 border-b">
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <div className="px-4 divide-y">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between py-3">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36 rounded" />
                  <Skeleton className="h-3 w-52 rounded" />
                </div>
                <Skeleton className="h-6 w-10 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
