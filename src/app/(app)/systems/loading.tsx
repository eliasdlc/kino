import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { RowsSkeleton } from "@/components/Skeletons";

/** La forma de Sistemas: el título con su acción y la lista de sistemas como filas de índice. */
export default function SystemsLoading() {
  return (
    <PageWrapper aria-busy>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-[2.85rem] w-40 rounded-full" />
      </div>
      <RowsSkeleton rows={6} margin="numeral" />
    </PageWrapper>
  );
}
