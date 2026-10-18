import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { RowsSkeleton } from "@/components/Skeletons";

/**
 * La forma de Bandeja: el título en la columna de texto con la cuenta a la
 * derecha, la línea de debajo (que Bandeja pinta siempre que tiene algo) y las
 * filas de margen con su círculo. El margen no se pliega en escritorio: las
 * filas lo llevan y el título se alinea con su texto.
 */
export default function BandejaLoading() {
  return (
    <PageWrapper aria-busy className="w-full">
      <div className="space-y-4">
        <div className="grid grid-cols-[var(--margen)_1fr_auto] items-baseline">
          <span />
          <div className="space-y-1">
            <Skeleton className="h-[2.115rem] w-32" />
            <div className="flex h-[1.25rem] items-center">
              <Skeleton className="h-3.5 w-56" />
            </div>
          </div>
          <Skeleton className="h-5 w-6" />
        </div>
        <RowsSkeleton rows={5} margin="circle" />
      </div>
    </PageWrapper>
  );
}
