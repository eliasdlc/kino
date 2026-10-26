import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { BreadcrumbSkeleton, RowsSkeleton } from "@/components/Skeletons";
import { Readings } from "@/features/systems/SystemDetailHeader";
import { cn } from "@/lib/utils";

/**
 * Un renglón de texto que espera: la barra va dentro de un párrafo con la
 * tipografía real, así que ocupa el alto de línea de lo que va a llegar y no
 * un alto inventado.
 */
function Renglon({ className, ancho }: { className: string; ancho: string }) {
  return (
    <span className={cn("block", className)}>
      <span className={cn("inline-block h-[0.72em] rounded-md bg-muted align-middle", ancho)} />
    </span>
  );
}

/**
 * La forma de un sistema, con la geometría de `SystemDetailHeader`: el tile
 * en el margen, la columna de texto y la de acciones, el eyebrow y el nombre
 * en dos renglones en el teléfono, la intención en dos, las tres lecturas
 * con su palabra en dos, la fila de «Cómo va» de 48 px y las pestañas-palabra
 * de 48 px sobre su hairline. Después, las filas de la superficie. Así el
 * índice no salta cuando llega la página.
 */
export default function SystemLoading() {
  return (
    <div aria-busy className="w-full">
      <div className="sticky top-0 z-(--z-raised) hidden border-b bg-background px-4 py-2.5 md:block md:px-6">
        <BreadcrumbSkeleton segments={2} />
      </div>

      <PageWrapper className="w-full">
        <div className="w-full space-y-5">
          <div className="grid grid-cols-[var(--margen)_1fr_auto] gap-y-3">
            <span className="flex justify-start self-start pt-1">
              <Skeleton className="size-[2.4rem] rounded-xl" />
            </span>

            <div className="min-w-0 space-y-2">
              {/* En el teléfono el eyebrow (tipo, energía, frecuencia) y el nombre
                  en 1.9rem parten casi siempre en dos renglones; en escritorio, uno. */}
              <div>
                <Renglon className="text-xs" ancho="w-44" />
                <Renglon className="text-xs md:hidden" ancho="w-20" />
              </div>
              <div>
                <Renglon className="font-display text-[1.9rem] leading-[1.08]" ancho="w-3/4" />
                <Renglon className="font-display text-[1.9rem] leading-[1.08] md:hidden" ancho="w-1/2" />
              </div>
              <div>
                <Renglon className="text-[1.06rem] leading-normal" ancho="w-full" />
                <Renglon className="text-[1.06rem] leading-normal" ancho="w-2/3" />
              </div>
            </div>

            <div className="self-start pl-2">
              <Skeleton className="size-[2.85rem] rounded-full md:pointer-fine:size-9" />
            </div>

            <div className="col-start-2 col-end-4 min-w-0 space-y-3">
              <Readings readings={null} lineas={2} />
              <div className="flex min-h-[2.85rem] items-center md:pointer-fine:min-h-9">
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>

          {/* Las pestañas-palabra: 48 px de alto sobre su hairline. */}
          <div className="flex items-center gap-x-5 border-b border-border">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex h-[2.85rem] items-center px-1">
                <Skeleton className="h-4 w-16" />
              </span>
            ))}
          </div>
        </div>

        <div>
          <RowsSkeleton rows={4} margin="circle" />
        </div>
      </PageWrapper>
    </div>
  );
}
