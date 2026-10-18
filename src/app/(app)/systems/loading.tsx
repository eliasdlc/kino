import { PageWrapper } from "@/components/PageWrapper";
import { PageHeaderSkeleton, RowsSkeleton } from "@/components/Skeletons";

/** La forma de Sistemas: el título con su acción y la lista de sistemas como filas de índice. */
export default function SystemsLoading() {
  return (
    <PageWrapper aria-busy>
      <PageHeaderSkeleton accion />
      <RowsSkeleton rows={6} margin="numeral" />
    </PageWrapper>
  );
}
