import { PageHeader, PageWrapper } from "@/components/PageWrapper";
import { SettingsIndex } from "@/features/settings/SettingsIndex";

/**
 * Ajustes: un índice en tres grupos por frecuencia. Lo de cada día arriba, la
 * cuenta en medio y lo de una vez al final, con el borrado de la cuenta
 * cerrando la página. La pantalla entera vive en `SettingsIndex`; aquí sólo
 * van el papel y el título.
 */
export default function SettingsPage() {
  return (
    <PageWrapper>
      <PageHeader title="Ajustes" description="Lo de cada día arriba; lo de una vez, al final." />
      <SettingsIndex />
    </PageWrapper>
  );
}
