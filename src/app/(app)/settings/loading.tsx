import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { RowsSkeleton } from "@/components/Skeletons";

/** La forma de Ajustes: el título en la columna de texto, su voz, y grupos de filas de índice. */
export default function SettingsLoading() {
  return (
    <PageWrapper aria-busy>
      <div className="space-y-2 pl-(--margen) md:pl-0">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {[0, 1, 2].map((grupo) => (
        <section key={grupo} className="space-y-1">
          <Skeleton className="h-5 w-24" />
          <RowsSkeleton rows={3} margin="numeral" />
        </section>
      ))}
    </PageWrapper>
  );
}
