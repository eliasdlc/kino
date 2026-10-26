"use client";

import { useState, type ReactNode } from "react";
import { Bell, Mail, Smartphone, Trash2 } from "lucide-react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, useTestAuth, type QueryStub } from "@/shared/testing/convex-client";
import { Section, Seeded, SubSection, Specimen, seedQuery } from "../helpers";
import { AvisosBloqueadosBody, SettingsIndex, SettingsIndexSkeleton } from "@/features/settings/SettingsIndex";
import { IndexRow, Stepper, SwitchRow } from "@/features/settings/settings-ui";
import { ThemeRow } from "@/features/settings/ThemeRow";
import { EnergyLimitRow } from "@/features/settings/EnergyLimitRow";
import { TimezoneSheetBody } from "@/features/settings/TimezoneRow";
import { RemindersSection } from "@/features/settings/RemindersSection";
import { EnergyProfileSection } from "@/features/settings/EnergyProfileSection";
import { WeeklyReviewDaySection } from "@/features/settings/WeeklyReviewDaySection";
import { TrashSection } from "@/features/settings/TrashSection";
import { ShortcutsSection } from "@/features/settings/ShortcutsSection";
import { ConnectionsSection } from "@/features/settings/ConnectionsSection";
import { DigestsSection } from "@/features/settings/DigestsSection";
import { DataPortabilitySection } from "@/features/settings/DataPortabilitySection";
import { DangerZoneSection, DeleteAccountBody } from "@/features/account/DangerZoneSection";
import { useDeleteAccount } from "@/features/account/account.hooks";
import { AJUSTES_DE_PRUEBA, CUENTA_DE_PRUEBA } from "@/features/settings/settings-fixtures";

/** El ancho del teléfono de las capturas, con el margen de la casa encendido. */
function Telefono({ children }: { children: ReactNode }) {
  return <div className="w-[360px] max-w-full shrink-0 bg-background px-5 py-4">{children}</div>;
}

const PERFIL = {
  chronotype: "intermediate" as const,
  sleepTypicalHours: 7,
  availableHoursPerDay: 6,
  rechargePresets: [
    { label: "Salir a caminar", delta: 15 },
    { label: "Reuniones largas", delta: -15 },
  ],
  hasLearnedCurve: false,
};

const AVISOS = { dispositivos: 2, pushConfigurado: true, correoConfigurado: true, email: "prueba@usekino.dev" };

const SEMILLA_INDICE = [
  seedQuery(api.settings.get, AJUSTES_DE_PRUEBA),
  seedQuery(api.energy.profile, PERFIL),
  seedQuery(api.notifications.estado, AVISOS),
  seedQuery(api.users.current, { name: "Prueba Kino", email: "prueba@usekino.dev" }),
  seedQuery(api.connections.list, [{ provider: "github", connected: false, lastSyncedAt: null, linkedSystems: 0 }]),
];

const PAPELERA_VACIA = [
  seedQuery(api.tasks.list, { items: [], restantes: 0 }),
  seedQuery(api.pages.trashed, []),
  seedQuery(api.entities.trashed, []),
  seedQuery(api.folders.trashed, []),
  seedQuery(api.stickyNotes.trashed, []),
];

const glifo = "size-5 stroke-[1.8]";

/** Lo que responde `github.status` sin cuenta enlazada, configurada o no. */
function estadoGithub(configured: boolean): QueryStub {
  return { name: getFunctionName(api.github.status), value: { connected: false, login: null, lastSyncedAt: null, revoked: false, configured } };
}

/**
 * `Seeded` con la respuesta de una acción además de las queries: la hoja de
 * Conexiones pregunta a `github.status` si la integración existe, y `Seeded`
 * sólo siembra queries. El mismo árbol, con el segundo argumento del cliente.
 */
function SeededConEscrituras({ stubs, escrituras, children }: { stubs: QueryStub[]; escrituras: QueryStub[]; children: ReactNode }) {
  const [client] = useState(() => makeTestConvexClient(stubs, escrituras) as unknown as ConvexReactClient);
  return (
    <ConvexProviderWithAuth client={client} useAuth={useTestAuth}>
      <ConvexQueryCacheProvider expiration={0} maxIdleEntries={0}>
        {children}
      </ConvexQueryCacheProvider>
    </ConvexProviderWithAuth>
  );
}

const PAPELERA_CON_FILAS = [
  seedQuery(api.tasks.list, { items: [{ id: "t1", title: "Comprar tinta", deletedAt: "2026-10-12T15:00:00.000Z" }], restantes: 0 }),
  seedQuery(api.pages.trashed, [{ id: "p1", title: "La daga", deletedAt: "2026-10-14T10:00:00.000Z", subpageCount: 2 }]),
  seedQuery(api.entities.trashed, []),
  seedQuery(api.folders.trashed, [{ id: "f1", name: "Parte 1", deletedAt: "2026-10-15T10:00:00.000Z", subfolderCount: 3 }]),
  seedQuery(api.stickyNotes.trashed, [{ id: "n1", title: null, content: "Falta el mapa", deletedAt: "2026-10-10T10:00:00.000Z" }]),
];

const DIGESTS = [
  { id: "d1", source: "claude-code", externalId: "a", createdAt: "2026-10-17T21:40:00.000Z", bytes: 4210 },
  { id: "d2", source: "claude-code", externalId: "b", createdAt: "2026-10-16T19:05:00.000Z", bytes: 3870 },
];

/** El cuerpo de la confirmación de borrar la cuenta, con su acción. */
function BorrarCuenta() {
  const deleteAccount = useDeleteAccount();
  return <DeleteAccountBody email="prueba@usekino.dev" onClose={() => {}} deleteAccount={deleteAccount} enfocar={false} />;
}

export function SettingsSection() {
  return (
    <Section
      id="ajustes"
      number="20"
      title="Ajustes"
      description="Un índice en tres grupos por frecuencia, sin cajas: Cada día, Cuenta y Una vez. Lo de un toque se hace en la fila; lo demás abre su hoja. Todo guarda al tocar y nada avisa de que guardó. Cada fila mide lo mismo con datos y sin ellos, y el esqueleto dibuja las mismas filas."
    >
      <SubSection
        title="El índice y su esqueleto"
        description="La pantalla entera a 360 px con la cuenta de muestra, y al lado el loading.tsx de la ruta. Los dos tienen los mismos tres grupos y las mismas filas del mismo alto: es lo que deja el CLS de Ajustes en cero."
      >
        <div className="flex flex-wrap gap-6">
          <Specimen label="Índice con datos" hint="SettingsIndex">
            <Telefono>
              <SeededConEscrituras stubs={SEMILLA_INDICE} escrituras={[estadoGithub(true)]}>
                <SettingsIndex />
              </SeededConEscrituras>
            </Telefono>
          </Specimen>
          <Specimen label="Índice esperando" hint="SettingsIndexSkeleton, en settings/loading.tsx">
            <Telefono>
              <SettingsIndexSkeleton />
            </Telefono>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Las filas"
        description="Glifo en el margen, título y meta en un renglón cada uno, valor y chevron a la derecha. La meta que todavía no llegó ocupa su renglón con un tono de superficie. El rojo sólo en lo irreversible; el coral sólo junto a la palabra de estado."
      >
        <div className="flex flex-wrap gap-6">
          <Specimen label="Fila que abre su hoja" hint="IndexRow onOpen">
            <Telefono>
              <IndexRow icon={<Bell aria-hidden className={glifo} />} title="Recordatorios" meta="Resumen a las 8:00" value="Medios" onOpen={() => {}} />
            </Telefono>
          </Specimen>
          <Specimen label="Fila esperando su meta" hint="meta={undefined}">
            <Telefono>
              <IndexRow icon={<Bell aria-hidden className={glifo} />} title="Recordatorios" meta={undefined} onOpen={() => {}} />
            </Telefono>
          </Specimen>
          <Specimen label="Lo irreversible, en su sitio" hint="DangerZoneSection: la última fila de Una vez">
            <Telefono>
              <Seeded stubs={[seedQuery(api.users.current, CUENTA_DE_PRUEBA)]}>
                <IndexRow icon={<Trash2 aria-hidden className={glifo} />} title="Papelera" meta="Lo borrado, hasta que lo restaures" onOpen={() => {}} />
                <DangerZoneSection />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Valor sin chevron" hint="IndexRow sin onOpen: el valor queda en la columna de los demás">
            <Telefono>
              <IndexRow icon={<Bell aria-hidden className={glifo} />} title="Recordatorios" meta="Resumen a las 8:00" value="Medios" onOpen={() => {}} />
              <IndexRow icon={<Bell aria-hidden className={glifo} />} title="Informativa" meta="Sólo dice su valor" value="Medios" />
            </Telefono>
          </Specimen>
          <Specimen label="Avisos bloqueados" hint='IndexRow tone="warn": abre cómo desbloquearlos'>
            <Telefono>
              <IndexRow icon={<Smartphone aria-hidden className={glifo} />} title="Avisos en este dispositivo" meta="Bloqueados en este navegador" tone="warn" onOpen={() => {}} />
            </Telefono>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="El tema, el stepper y el interruptor"
        description="El tema es un segmento en tinta y la línea de debajo sale del mismo valor, así que no contradice al segmento. El límite diario es el stepper injertado de Instrumento: un toque por paso de cinco, guardado cuando los toques paran. El interruptor toma la fila entera como zona de toque."
      >
        <div className="flex flex-wrap gap-6">
          <Specimen label="Tema" hint="ThemeRow">
            <Telefono>
              <Seeded stubs={[]}>
                <ThemeRow />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Límite diario" hint="EnergyLimitRow">
            <Telefono>
              <Seeded stubs={[seedQuery(api.settings.get, AJUSTES_DE_PRUEBA)]}>
                <EnergyLimitRow />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Stepper en sus estados" hint="Stepper: con valor, en el tope, esperando">
            <Stepper value={7} min={4} max={12} onChange={() => {}} unit="h" stepLabel="una hora" />
            <Stepper value={12} min={4} max={12} onChange={() => {}} unit="h" stepLabel="una hora" />
            <Stepper value={undefined} min={4} max={12} onChange={() => {}} stepLabel="una hora" />
          </Specimen>
          <Specimen label="Interruptor de fila completa" hint="SwitchRow: encendido, bloqueado con su palabra de estado, desactivado">
            <Telefono>
              <SwitchRow icon={<Smartphone aria-hidden className={glifo} />} title="Avisos en este dispositivo" meta="Activos en 2 dispositivos" checked onCheckedChange={() => {}} />
              <SwitchRow icon={<Smartphone aria-hidden className={glifo} />} title="Avisos en este dispositivo" meta="Bloqueados en este navegador" tone="warn" checked={false} disabled onCheckedChange={() => {}} />
              <SwitchRow icon={<Mail aria-hidden className={glifo} />} title="También por correo" meta="El correo no está configurado en el servidor" checked={false} disabled onCheckedChange={() => {}} />
            </Telefono>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Las hojas"
        description="Lo que cada hoja pinta, fuera de su hoja para poder mirarlo. En el teléfono va en la hoja inferior; en escritorio, en el diálogo. Las mismas filas de margen que el índice; los controles que no caben a la derecha van debajo del texto."
      >
        <div className="flex flex-wrap gap-6">
          <Specimen label="Recordatorios" hint="RemindersSection">
            <Telefono>
              <Seeded stubs={[seedQuery(api.settings.get, AJUSTES_DE_PRUEBA), seedQuery(api.notifications.estado, AVISOS)]}>
                <RemindersSection />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Energía" hint="EnergyProfileSection">
            <Telefono>
              <Seeded stubs={[seedQuery(api.energy.profile, PERFIL)]}>
                <EnergyProfileSection />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Revisión semanal" hint="WeeklyReviewDaySection">
            <Telefono>
              <Seeded stubs={[seedQuery(api.settings.get, AJUSTES_DE_PRUEBA)]}>
                <WeeklyReviewDaySection />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Papelera vacía" hint="TrashSection, EmptyState">
            <Telefono>
              <Seeded stubs={PAPELERA_VACIA}>
                <TrashSection />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Papelera con filas" hint="TrashSection: restaurar avisa con Deshacer">
            <Telefono>
              <Seeded stubs={PAPELERA_CON_FILAS}>
                <TrashSection />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Conexiones, sin la integración" hint="ConnectionsSection: la fila dice que no está disponible">
            <Telefono>
              <SeededConEscrituras
                stubs={[seedQuery(api.connections.list, [{ provider: "github", connected: false, lastSyncedAt: null, linkedSystems: 0 }])]}
                escrituras={[estadoGithub(false)]}
              >
                <ConnectionsSection />
              </SeededConEscrituras>
            </Telefono>
          </Specimen>
          <Specimen label="Diario de sesiones" hint="DigestsSection: fecha y tamaño, nunca el contenido">
            <Telefono>
              <Seeded stubs={[seedQuery(api.digests.list, DIGESTS)]}>
                <DigestsSection />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Datos y exportación" hint="DataPortabilitySection">
            <Telefono>
              <DataPortabilitySection />
            </Telefono>
          </Specimen>
          <Specimen label="Zona horaria distinta" hint="TimezoneSheetBody: las dos zonas y usar la de aquí">
            <Telefono>
              <TimezoneSheetBody cuenta="America/Santo_Domingo" dispositivo="Europe/Madrid" cambiando={false} usarLaDeAqui={() => {}} />
            </Telefono>
          </Specimen>
          <Specimen label="Avisos bloqueados, la hoja" hint="AvisosBloqueadosBody">
            <Telefono>
              <AvisosBloqueadosBody />
            </Telefono>
          </Specimen>
          <Specimen label="Borrar tu cuenta" hint="DeleteAccountBody: la copia antes y el correo para confirmar">
            <Telefono>
              <Seeded stubs={[]}>
                <BorrarCuenta />
              </Seeded>
            </Telefono>
          </Specimen>
          <Specimen label="Atajos de teclado, sólo escritorio" hint="ShortcutsSection">
            <div className="w-[28rem] max-w-[calc(100vw-4rem)]">
              <ShortcutsSection />
            </div>
          </Specimen>
        </div>
      </SubSection>
    </Section>
  );
}
