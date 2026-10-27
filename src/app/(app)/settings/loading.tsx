import { PageWrapper } from "@/components/PageWrapper";
import { PageHeaderSkeleton } from "@/components/Skeletons";
import { SettingsIndexSkeleton } from "@/features/settings/SettingsIndex";

/**
 * La forma de Ajustes mientras llega: el título con su voz y los tres grupos
 * con sus filas del alto real. Sale del mismo componente que dibuja el
 * índice, para que el esqueleto y la pantalla no puedan dejar de coincidir.
 */
export default function SettingsLoading() {
  return (
    <PageWrapper aria-busy>
      <PageHeaderSkeleton voz />
      <SettingsIndexSkeleton />
    </PageWrapper>
  );
}
