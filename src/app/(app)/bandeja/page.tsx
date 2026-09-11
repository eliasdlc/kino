import { notFound, redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { PageWrapper } from "@/components/PageWrapper";
import { InboxView } from "@/features/systems/views/InboxView";
import { getServerSession } from "@/shared/utils/session";

/**
 * Bandeja, con su propia URL.
 *
 * Hasta ahora vivía en `/systems/<uuid>` y el id salía de un
 * `systems.find((s) => s.isInbox)` repetido en cuatro sitios del cliente.
 * Meterla en la barra inferior habría sido el quinto, y además una entrada de
 * navegación que no sabe a dónde va hasta que carga la lista de sistemas.
 *
 * Aquí el id se resuelve en el servidor con `systems.inbox` y la superficie se
 * pinta directamente. **No es un redirect**: un redirect duplicaría el viaje y
 * dejaría la URL en `/systems/<uuid>`, que no es compartible ni memorizable.
 */
export default async function BandejaPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const inbox = await serverQuery(api.systems.inbox, {});
  if (!inbox) notFound();

  const tasks = await serverQuery(api.tasks.bySystem, { systemId: inbox.id });

  return (
    <PageWrapper className="w-full">
      <InboxView system={inbox} initialTasks={tasks} />
    </PageWrapper>
  );
}
