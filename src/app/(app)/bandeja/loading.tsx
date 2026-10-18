import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { RowsSkeleton } from "@/components/Skeletons";

/** La forma de Bandeja: título, cifra y las filas de captura con su círculo. */
export default function BandejaLoading() {
  return (
    <PageWrapper aria-busy className="w-full">
      <div className="flex items-baseline gap-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="ml-auto h-4 w-6" />
      </div>
      <RowsSkeleton rows={5} margin="circle" />
    </PageWrapper>
  );
}
