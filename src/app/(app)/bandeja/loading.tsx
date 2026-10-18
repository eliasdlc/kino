import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { RowsSkeleton } from "@/components/Skeletons";

/**
 * La forma de Bandeja: el título en la columna de texto con la cuenta a la
 * derecha, y las filas de margen con su círculo.
 */
export default function BandejaLoading() {
  return (
    <PageWrapper aria-busy className="w-full">
      <div className="grid grid-cols-[var(--margen)_1fr_auto] items-center md:grid-cols-[0_1fr_auto]">
        <span />
        <Skeleton className="h-[2.115rem] w-32" />
        <Skeleton className="h-5 w-6" />
      </div>
      <RowsSkeleton rows={5} margin="circle" />
    </PageWrapper>
  );
}
