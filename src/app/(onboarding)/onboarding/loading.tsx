import { Skeleton } from "@/components/ui/skeleton";

/** La forma de la única pregunta del alta: título, su frase, la galería y el botón. */
export default function OnboardingLoading() {
  return (
    <div aria-busy className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-5">
      <div className="space-y-3">
        <Skeleton className="h-9 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex-1 space-y-2 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid min-h-[3.4rem] grid-cols-[var(--margen)_1fr] items-center border-b border-border py-2 last:border-b-0">
            <span className="flex justify-center">
              <Skeleton className="size-6 rounded-full" />
            </span>
            <span className="space-y-1.5">
              <Skeleton className={i % 2 === 0 ? "h-4 w-1/2" : "h-4 w-2/3"} />
              <Skeleton className="h-3 w-4/5" />
            </span>
          </div>
        ))}
      </div>
      <Skeleton className="h-[3.2rem] w-full rounded-full" />
    </div>
  );
}
