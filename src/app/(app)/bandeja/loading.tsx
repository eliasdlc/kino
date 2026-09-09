import { Skeleton } from "@/components/ui/skeleton";

/** El esqueleto tiene la forma de la lista que viene: título, cifra y filas. */
export default function BandejaLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-1 p-6">
      <div className="flex items-baseline gap-3 pb-2">
        <Skeleton className="h-6 w-28 rounded" />
        <Skeleton className="ml-auto h-4 w-6 rounded" />
      </div>
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="flex items-center gap-3 border-b border-border py-3">
          <Skeleton className="size-5 shrink-0 rounded-sm" />
          <Skeleton className="h-4 flex-1 rounded" />
          <Skeleton className="size-4 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}
