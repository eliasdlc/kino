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
      {/* En escritorio PageHeader esconde su margen con display none, y entonces
          el texto cae en la columna de ancho 0 y la voz sale a una palabra por
          línea. Aquí se devuelve el texto a su columna; la corrección de fondo
          es del shell (PageWrapper.tsx). */}
      <div className="md:[&_[data-slot=page-header-margin]+div]:col-start-2">
        <PageHeader title="Ajustes" description="Lo de cada día arriba; lo de una vez, al final." />
      </div>
      <SettingsIndex />
    </PageWrapper>
  );
}
