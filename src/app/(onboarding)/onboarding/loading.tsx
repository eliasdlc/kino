import { Skeleton } from "@/components/ui/skeleton";

/**
 * La forma de la única pregunta del alta: título, su frase, las filas de
 * margen con el icono y la marca, y el botón con su línea debajo.
 */
export default function OnboardingLoading() {
  return (
    <div aria-busy className="mx-auto flex h-dvh w-full max-w-md flex-col gap-4 p-5">
      <div className="space-y-2">
        <Skeleton className="h-9 w-4/5" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="flex-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="grid min-h-[3.6rem] grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border last:border-b-0">
            <span className="flex justify-center">
              <Skeleton className="size-5 rounded-md" />
            </span>
            <span className="space-y-1.5 py-2.5">
              <Skeleton className={i % 2 === 0 ? "h-4 w-1/2" : "h-4 w-2/3"} />
              <Skeleton className="h-3 w-4/5" />
            </span>
            <Skeleton className="mr-1 ml-2.5 size-[1.35rem] rounded-full" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-[3.2rem] w-full rounded-full" />
        <Skeleton className="mx-auto h-3 w-64" />
      </div>
    </div>
  );
}
