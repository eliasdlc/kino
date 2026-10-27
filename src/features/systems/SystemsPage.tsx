import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateSystemDialog } from "./CreateSystemDialog";
import { SystemsList } from "./SystemsList";
import { PageWrapper, PageHeader } from "@/components/PageWrapper";

/**
 * El índice de sistemas. Crear uno es la acción primaria de la pantalla, en
 * ámbar y a su ancho, no una pastilla de contorno a todo el ancho con el mismo
 * peso que el buscador; sin el brillo del botón, porque en Diario nada flota.
 */
export default function SystemsPage() {
  return (
    <PageWrapper>
      <PageHeader
        title="Sistemas"
        actions={
          <CreateSystemDialog
            trigger={
              <Button className="gap-2 shadow-none">
                <Plus aria-hidden className="size-4" />
                Nuevo sistema
              </Button>
            }
          />
        }
      />

      <SystemsList />
    </PageWrapper>
  );
}
