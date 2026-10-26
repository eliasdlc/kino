import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { PageHeaderSkeleton, RowsSkeleton } from "@/components/Skeletons";

/** La forma de Ajustes: el título en la columna de texto, su voz, y grupos de filas de índice. */
export default function SettingsLoading() {
  return (
    <PageWrapper aria-busy>
      <PageHeaderSkeleton voz />
      {[0, 1, 2].map((grupo) => (
        <section key={grupo} className="space-y-1">
          <Skeleton className="h-5 w-24" />
          <RowsSkeleton rows={3} margin="numeral" />
        </section>
      ))}
    </PageWrapper>
  );
}
