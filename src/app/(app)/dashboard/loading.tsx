import { Skeleton } from "@/components/ui/skeleton";

/** La forma de Hoy mientras llega: la cota a la izquierda, el plan a la derecha. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-5 md:px-8 md:py-6">
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:gap-10">
        <div className="space-y-4 md:border-r md:border-border md:pr-10">
          <Skeleton className="h-3 w-40" />
          <div className="grid grid-cols-[auto_1fr] items-center gap-4">
            <Skeleton className="h-[3.6rem] w-[5.5rem] rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-[76px] w-full rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-[2.8rem] flex-1 rounded-full" />
            <Skeleton className="h-[2.8rem] flex-1 rounded-full" />
            <Skeleton className="h-[2.8rem] flex-1 rounded-full" />
          </div>
        </div>
        <div className="mt-8 space-y-3 md:mt-0">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[1.3rem_1fr] gap-3 py-2">
              <Skeleton className="size-[1.3rem] rounded-full" />
              <Skeleton className={i % 2 === 0 ? "h-4 w-4/5" : "h-4 w-3/5"} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
