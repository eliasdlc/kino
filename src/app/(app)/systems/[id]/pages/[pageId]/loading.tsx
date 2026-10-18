import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton } from "@/components/Skeletons";

/** La forma de un manuscrito: las migas, la hoja con su título y sus líneas, y en escritorio el panel lateral. */
export default function PageEditorLoading() {
  return (
    <div aria-busy className="flex h-dvh flex-col overflow-hidden">
      <div className="sticky top-0 z-(--z-raised) shrink-0 border-b bg-background px-4 py-2.5 md:px-6">
        <BreadcrumbSkeleton segments={3} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-8 px-5 py-8 md:px-6">
            <div className="space-y-4 pt-2">
              <Skeleton className="h-9 w-2/3" />
              <div className="space-y-3 pt-2">
                {["w-full", "w-[92%]", "w-[85%]", "w-full", "w-[78%]", "w-[90%]"].map((w, i) => (
                  <Skeleton key={i} className={`h-4 ${w}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden w-72 overflow-y-auto border-l bg-card/50 md:block">
          <div className="space-y-6 p-4">
            {[0, 1, 2].map((bloque) => (
              <div key={bloque} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-[90%]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
