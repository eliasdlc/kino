"use client";

import { api } from "@convex/_generated/api";

import { Section, SubSection, Specimen, SpecimenGrid, Seeded, seedQuery } from "../helpers";
import { makeSystem, makeTask, makeFolder, daysFromNow, MOCK_SYSTEM_ID, mid } from "../mock-data";
import { SystemRow } from "@/features/systems/SystemRow";
import { SystemsList } from "@/features/systems/SystemsList";
import { SystemTreeItem } from "@/features/systems/SystemTreeItem";
import { SidebarUserMenuView } from "@/features/systems/SidebarUserMenu";
import { TaskCardFor } from "@/features/tasks/cards/TaskCardFor";
import { ItemEventList } from "@/features/tasks/ItemEventList";
import { AgentActivityRow } from "@/features/today/AgentActivityRow";
import { ProposalBody } from "@/features/today/ProposalBody";
import { GithubRepoPanelView } from "@/features/github-sync/GithubRepoPanelView";
import { DangerZoneSection } from "@/features/account/DangerZoneSection";
import { RemindersSection } from "@/features/settings/RemindersSection";
import { PriorityTag } from "@/features/tasks/cards/parts/TaskTags";
/** Lo que la zona de peligro lee del usuario: nombre y correo. El resto del documento no lo pinta. */
const ACCOUNT = { name: "Elias De La Cruz", email: "elias@kino.dev" };

const noop = () => {};

/** Los ajustes que la sección de recordatorios lee. */
const AJUSTES_AVISOS = {
  dailyEnergyLimit: 50,
  timezone: "America/Santo_Domingo",
  theme: "system",
  notificationsEnabled: true,
  weeklyReviewDay: "sun",
  wordsSeen: [],
  reminderIntensity: "aggressive",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  morningDigestTime: "08:00",
  emailReminders: true,
};

/** Tres filas del log: el agente, otra persona y algo ya deshecho. */
const EVENTOS = [
  {
    id: mid("eventLog"),
    action: "task.create",
    actor: { kind: "propio" as const, channel: "oauth" as const, name: ACCOUNT.name },
    occurredAt: new Date(Date.now() - 120_000).toISOString(),
    undoneAt: null,
    undoneFields: null,
    desdePropuesta: false,
    deshacer: { forma: "inverse" as const },
  },
  {
    id: mid("eventLog"),
    action: "task.update",
    actor: { kind: "redactado" as const, channel: "session" as const },
    occurredAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    undoneAt: null,
    undoneFields: null,
    desdePropuesta: false,
    deshacer: { forma: "no" as const, motivo: "Ese cambio no es tuyo." },
  },
  {
    id: mid("eventLog"),
    action: "task.move",
    actor: { kind: "propio" as const, channel: "oauth" as const, name: ACCOUNT.name },
    occurredAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    undoneAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    undoneFields: ["status"],
    desdePropuesta: true,
    deshacer: { forma: "no" as const, motivo: "Esto ya se deshizo." },
  },
];

/** El índice de /systems con más de los que caben sin buscar: la Bandeja y siete sistemas. */
const SISTEMAS = [
  makeSystem({ id: mid("sl-inbox"), name: "Bandeja", isInbox: true, templateType: "inbox", activeTaskCount: 3 }),
  makeSystem({ id: mid("sl-uni"), name: "Universidad", color: "blue", templateType: "academic", icon: "graduation", activeTaskCount: 6, daysSinceLastActivity: 0 }),
  makeSystem({ id: mid("sl-novela"), name: "La casa de las cotas", color: "purple", templateType: "writing", icon: "feather", activeTaskCount: 1, daysSinceLastActivity: 2 }),
  makeSystem({ id: mid("sl-kino"), name: "Kino", color: "orange", templateType: "project", icon: "rocket", activeTaskCount: 9, daysSinceLastActivity: 0 }),
  makeSystem({ id: mid("sl-salud"), name: "Salud", color: "green", templateType: "personal", icon: "heart", stale: true, activeTaskCount: 2, daysSinceLastActivity: 14 }),
  makeSystem({ id: mid("sl-tienda"), name: "La tienda", color: "teal", templateType: "entrepreneurial", icon: "money", activeTaskCount: 4, daysSinceLastActivity: 5 }),
  makeSystem({ id: mid("sl-casa"), name: "Casa", color: "gray", templateType: "personal", icon: "home", activeTaskCount: 0, daysSinceLastActivity: 30, stale: true }),
  makeSystem({ id: mid("sl-papeles"), name: "Papeles", color: "white", templateType: "custom", icon: "folder", activeTaskCount: 0, daysSinceLastActivity: null }),
];

/** Los sistemas del sidebar del specimen: uno activo, uno fijado y uno dormido. */
const ARBOL = {
  novela: makeSystem({ id: mid("st-novela"), name: "La casa de las cotas", color: "purple", templateType: "writing", icon: "feather" }),
  uni: makeSystem({ id: mid("st-uni"), name: "Universidad", color: "blue", templateType: "academic", icon: "graduation" }),
  salud: makeSystem({ id: mid("st-salud"), name: "Salud", color: "green", templateType: "personal", icon: "heart", stale: true, daysSinceLastActivity: 14 }),
};

/** Lo que el chevron enseña al desplegar la novela. */
const OBRAS_DEL_ARBOL = [
  makeFolder({ id: mid("st-obra-1"), name: "Primera parte: la subida", systemId: ARBOL.novela.id }),
  makeFolder({ id: mid("st-obra-2"), name: "Segunda parte", systemId: ARBOL.novela.id }),
];

export function KinoSection() {
  return (
    <Section
      id="kino"
      number="09"
      title="Componentes Kino"
      description="Componentes propios del producto, renderizados con datos de muestra: son los mismos componentes de producción, así que cualquier cambio en ellos se refleja aquí."
    >
      <SubSection
        title="SystemRow"
        description="El índice de /systems: el glifo del sistema en su color en el margen, el nombre, y en la meta tipo, activas y última actividad. Dormido va en coral con la palabra delante. La Bandeja es la primera fila y lleva a /bandeja. Las operaciones con nombre van en el botón de la derecha: menú en escritorio, hoja inferior en el teléfono."
      >
        <div className="w-full max-w-xl">
          <SystemRow system={makeSystem({ id: mid("sr-inbox"), name: "Inbox", isInbox: true, templateType: "inbox", activeTaskCount: 4 })} />
          <SystemRow
            system={makeSystem({ id: mid("sr-uni"), name: "Universidad", color: "blue", templateType: "academic", icon: "graduation" })}
            onEdit={noop}
            onDelete={noop}
          />
          <SystemRow
            system={makeSystem({ id: mid("sr-novela"), name: "La casa de las cotas", color: "purple", templateType: "writing", icon: "feather", activeTaskCount: 1, daysSinceLastActivity: 0 })}
            onEdit={noop}
            onDelete={noop}
          />
          <SystemRow
            system={makeSystem({ id: mid("sr-salud"), name: "Salud", color: "green", templateType: "personal", icon: "heart", stale: true, activeTaskCount: 2, daysSinceLastActivity: 14 })}
            onEdit={noop}
            onDelete={noop}
          />
          <SystemRow
            system={makeSystem({ id: mid("sr-blanco"), name: "Papeles", color: "white", templateType: "custom", icon: "folder", activeTaskCount: 0, daysSinceLastActivity: null })}
            onEdit={noop}
            onDelete={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="SystemsList"
        description="El índice entero de /systems: la Bandeja primero y debajo una fila por sistema. Con seis sistemas o más ofrece buscar, y una búsqueda sin coincidencias lo dice con el nombre que buscaste y un Limpiar. Sin sistemas, el vacío explica qué es uno y ofrece crearlo."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Con siete sistemas" hint="aparece el campo de buscar" className="items-stretch">
            <Seeded stubs={[seedQuery(api.systems.list, SISTEMAS)]}>
              <div className="w-full">
                <SystemsList />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Sin sistemas" hint="sólo la Bandeja: EmptyState con Crear sistema" className="items-stretch">
            <Seeded stubs={[seedQuery(api.systems.list, [SISTEMAS[0]])]}>
              <div className="w-full">
                <SystemsList />
              </div>
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="SystemTreeItem"
        description="Un sistema en el sidebar: el glifo en su color, el nombre y, a la derecha, las opciones con el nombre del sistema (Fijar, crear su contenedor, Eliminar). El chevron dice si está desplegado y de qué sistema habla; desplegar enseña sus carpetas. El activo lleva la barra en su color, el dormido un punto en mute. En touch el chevron, las opciones y cada carpeta miden 2.85rem, y las opciones se ven siempre en vez de asomar al pasar."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Expandido" hint="activo, fijado y dormido; toca el chevron de la novela para ver sus obras" className="items-stretch">
            <Seeded stubs={[seedQuery(api.folders.bySystem, OBRAS_DEL_ARBOL)]}>
              <div className="w-64 space-y-0.5 rounded-xl bg-sidebar p-2">
                <SystemTreeItem system={ARBOL.novela} isActive />
                <SystemTreeItem system={ARBOL.uni} isActive={false} isPinned />
                <SystemTreeItem system={ARBOL.salud} isActive={false} />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Sidebar plegado" hint="sólo el glifo; el enlace se nombra con el sistema y el dormido lleva su punto">
            <Seeded stubs={[seedQuery(api.folders.bySystem, OBRAS_DEL_ARBOL)]}>
              <div className="w-14 space-y-0.5 rounded-xl bg-sidebar p-2">
                <SystemTreeItem system={ARBOL.novela} isActive collapsed />
                <SystemTreeItem system={ARBOL.uni} isActive={false} collapsed />
                <SystemTreeItem system={ARBOL.salud} isActive={false} collapsed />
              </div>
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="SidebarUserMenu"
        description="La cuenta al pie del sidebar: avatar, nombre y correo, y un menú con Ajustes y Cerrar sesión, lo irreversible al final y en carmesí. Aquí se monta SidebarUserMenuView, el dibujo sin la sesión de Clerk; en la app SidebarUserMenu le pone el cierre de sesión. En touch el disparador mide 2.85rem, también plegado."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Sidebar abierto" hint="con iniciales: sin foto" className="items-stretch">
            <div className="w-64 rounded-xl bg-sidebar p-2">
              <SidebarUserMenuView userName={ACCOUNT.name} userEmail={ACCOUNT.email} userImage={null} onSignOut={noop} />
            </div>
          </Specimen>
          <Specimen label="Sidebar plegado" hint="sólo el avatar, nombrado con la cuenta">
            <div className="w-14 rounded-xl bg-sidebar p-2">
              <SidebarUserMenuView userName={ACCOUNT.name} userEmail={ACCOUNT.email} userImage={null} collapsed onSignOut={noop} />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Task cards: estados"
        description="DefaultTaskCard (sistemas custom) en todos sus estados de fecha y prioridad. Ya no es una card: es la fila de tarea en densidad lista, una debajo de otra con su hairline. El círculo y las acciones son interactivos."
      >
        <div className="max-w-2xl">
          {[
            makeTask({ id: mid("t-1"), title: "Tarea normal (today)", status: "today" }),
            makeTask({
              id: mid("t-2"),
              title: "Prioridad crítica",
              priority: "critical",
              status: "today",
            }),
            makeTask({ id: mid("t-3"), title: "Prioridad alta", priority: "high", status: "week" }),
            makeTask({
              id: mid("t-4"),
              title: "Vencida hace dos días",
              dueDate: daysFromNow(-2),
              status: "today",
            }),
            makeTask({
              id: mid("t-5"),
              title: "Con entrega próxima y descripción",
              description: "Expandible: haz clic para ver la descripción completa.",
              dueDate: daysFromNow(2),
              status: "tomorrow",
            }),
            makeTask({
              id: mid("t-6"),
              title: "Completada",
              status: "done",
              completedAt: new Date().toISOString(),
            }),
            makeTask({
              id: mid("t-8"),
              title: "Idea capturada",
              taskType: "idea",
              status: "backlog",
            }),
            makeTask({
              id: mid("t-9"),
              title: "Evento: examen final",
              taskType: "event",
              startDate: daysFromNow(5),
              dueDate: daysFromNow(5),
              status: "week",
              metadata: { eventSubtype: "exam" },
            }),
            makeTask({
              id: mid("t-10"),
              title: "Recordatorio: pagar matrícula",
              taskType: "reminder",
              dueDate: daysFromNow(3),
              status: "week",
            }),
          ].map((task) => (
            <TaskCardFor
              key={task.id}
              task={task}
              systemId={MOCK_SYSTEM_ID}
              systemType={null}
              onToggle={noop}
              onDelete={noop}
              onEdit={noop}
            />
          ))}
        </div>
      </SubSection>

      <SubSection
        title="Task cards: por arquetipo"
        description="La misma tarea en cada arquetipo (TaskCardFor decide la meta según systemType). Todas son la fila de tarea común; la de proyecto tampoco es card: su aro no es botón, porque el ticket se cierra moviéndolo a Hecho."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {(
            [
              ["academic", { course: "Cálculo II", professor: "Dra. Peña" }],
              ["project", { project: "Kino", reviewer: "Elias" }],
              ["entrepreneurial", { milestone: "MVP", kpi: "10 usuarios" }],
              ["personal", { why: "Dormir mejor" }],
            ] as const
          ).map(([type, metadata]) => (
            <div key={type} className="space-y-1.5">
              <p className="font-mono text-[11px] text-muted-foreground">{type}</p>
              <TaskCardFor
                task={makeTask({
                  id: mid(`arch-${type}`),
                  title: `Tarea en sistema ${type}`,
                  dueDate: daysFromNow(4),
                  metadata: metadata as Record<string, unknown>,
                })}
                systemId={MOCK_SYSTEM_ID}
                systemType={type}
                onToggle={noop}
                onDelete={noop}
                onEdit={noop}
              />
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection
        title="GithubRepoPanel: estados (KIN-135)"
        description="Barra del board de un sistema `project` para enlazar un repositorio y refrescar sus issues. Sólo la monta la vista project: ningún otro arquetipo ve esta integración. Tres estados según haya cuenta conectada y repositorio elegido, más el token caducado y el fallo al preguntar por la conexión, que degradan con aviso en vez de vaciar el board. Debajo del repositorio, en segundo plano, la salida que vuelve a empezar el recorrido cuando el cursor se quedó por detrás: arranca por los issues que llevan más tiempo sin cambiar, avanza por tramos de trescientos hacia los últimos tocados, y el texto lo dice antes de pulsarlo."
      >
        <div className="flex max-w-2xl flex-col gap-3">
          <Specimen label="Sin cuenta conectada" hint="el trabajo se hace en Ajustes">
            <GithubRepoPanelView state={{ kind: "disconnected" }} />
          </Specimen>
          <Specimen label="Conectado, sin repositorio" hint="acepta owner/repo pegado">
            <GithubRepoPanelView state={{ kind: "unlinked" }} />
          </Specimen>
          <Specimen label="Enlazado" hint="refresco bajo demanda">
            <GithubRepoPanelView
              state={{ kind: "linked", repo: { owner: "eliasdlc", repo: "kino" }, revoked: false }}
            />
          </Specimen>
          <Specimen label="Sincronizando">
            <GithubRepoPanelView
              state={{ kind: "linked", repo: { owner: "eliasdlc", repo: "kino" }, revoked: false }}
              syncing
            />
          </Specimen>
          <Specimen label="Volviendo a empezar el recorrido" hint="la salida cuando el refresco de cada día se quedó por detrás">
            <GithubRepoPanelView
              state={{ kind: "linked", repo: { owner: "eliasdlc", repo: "kino" }, revoked: false }}
              syncing
              syncingAll
            />
          </Specimen>
          <Specimen label="Token revocado" hint="degrada, no rompe">
            <GithubRepoPanelView
              state={{ kind: "linked", repo: { owner: "eliasdlc", repo: "kino" }, revoked: true }}
            />
          </Specimen>
          <Specimen label="No se pudo comprobar la conexión" hint="lo dice y ofrece reintentar, en vez de desaparecer">
            <GithubRepoPanelView state={{ kind: "error" }} />
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Cuenta (Ajustes)"
        description="Nombre, correo, contraseña y sesiones viven en el panel de Clerk, que necesita una sesión real y no cabe aquí. Lo propio de Kino es la zona de peligro: borrar la cuenta confirmando el correo."
      >
        <div className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
          <Specimen label="Zona de peligro" hint="confirma escribiendo el correo">
            <Seeded stubs={[seedQuery(api.users.current, ACCOUNT)]}>
              <div className="w-full">
                <DangerZoneSection />
              </div>
            </Seeded>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Recordatorios (Ajustes y tarea)"
        description="Cuánto insisten los avisos: la intensidad de la cuenta con lo que promete cada una, el resumen de la mañana, las horas de silencio, el correo y la prueba. La etiqueta de prioridad enseña cuándo la subió la fecha."
      >
        <div className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
          <Specimen label="Todo configurado" hint="agresivos, push en dos dispositivos y correo">
            <Seeded
              stubs={[
                seedQuery(api.settings.get, AJUSTES_AVISOS),
                seedQuery(api.notifications.estado, { dispositivos: 2, pushConfigurado: true, correoConfigurado: true, email: "prueba@usekino.dev" }),
              ]}
            >
              <div className="w-full">
                <RemindersSection />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Sin dispositivos ni correo" hint="lo dice en vez de prometer avisos que no van a llegar">
            <Seeded
              stubs={[
                seedQuery(api.settings.get, { ...AJUSTES_AVISOS, reminderIntensity: "low" }),
                seedQuery(api.notifications.estado, { dispositivos: 0, pushConfigurado: true, correoConfigurado: false, email: "prueba@usekino.dev" }),
              ]}
            >
              <div className="w-full">
                <RemindersSection />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Prioridad que cuenta" hint="elegida baja, la fecha la sube a crítica; elegida media, a alta; alta sin cambios">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityTag priority="critical" chosen="low" />
              <PriorityTag priority="high" chosen="medium" />
              <PriorityTag priority="high" chosen="high" />
            </div>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="AgentActivityRow"
        description="Lo que hizo tu agente hoy, bajo el plan. No pide una decisión, así que no gasta la única apertura del día. Con cero acciones no se pinta nada."
      >
        <Specimen label="Con actividad" hint="la cifra delante de la clase, el agente de sujeto">
          <Seeded
            stubs={[
              seedQuery(api.eventLog.delAgenteHoy, {
                total: 5,
                acciones: [
                  { action: "task.create", cuantas: 4 },
                  { action: "task.move", cuantas: 1 },
                ],
                sistemas: ["Tesis"],
                ids: [],
              }),
            ]}
          >
            <AgentActivityRow />
          </Seeded>
        </Specimen>
        <Specimen label="Sin actividad" hint="no deja hueco ni dice «sin actividad»">
          <Seeded stubs={[seedQuery(api.eventLog.delAgenteHoy, null)]}>
            <AgentActivityRow />
          </Seeded>
        </Specimen>
      </SubSection>

      <SubSection
        title="ProposalBody"
        description="El cuerpo de la línea de una propuesta del agente, en Hoy. La evidencia es un enlace a la fila que la justifica: es la diferencia entre una propuesta y una afirmación."
      >
        <Specimen label="Cancelar" hint="la única vía por la que un borrado sale del agente">
          <ProposalBody
            propuesta={{
              kind: "cancel",
              motivo: "Lleva dos meses sin tocarse",
              evidencia: { tipo: "task", id: mid("tasks"), titulo: "Revisar marco teórico", systemId: MOCK_SYSTEM_ID },
            }}
          />
        </Specimen>
        <Specimen label="Reescribir" hint="suplantar tu voz se propone, no se ejecuta">
          <ProposalBody
            propuesta={{
              kind: "rewrite",
              motivo: null,
              evidencia: { tipo: "page", id: mid("pages"), titulo: "Capítulo 1", systemId: MOCK_SYSTEM_ID },
            }}
          />
        </Specimen>
      </SubSection>

      <SubSection
        title="ItemEventList"
        description="Lo que le ha pasado a un item, en la hoja del propio item. El sujeto va delante, la vía se dice con palabras y la autoría del agente no pinta ningún control: hoy no hay nada que pulsar."
      >
        <Specimen label="Con actividad" hint="quién, por qué vía y cuándo; botón cuando se deshace, motivo cuando no">
          <Seeded stubs={[seedQuery(api.eventLog.porItem, { items: EVENTOS, restantes: 0 })]}>
            <ItemEventList targetType="task" targetId={mid("tasks")} />
          </Seeded>
        </Specimen>
        <Specimen label="Sin actividad" hint="lo dice con palabras, no deja un hueco">
          <Seeded stubs={[seedQuery(api.eventLog.porItem, { items: [], restantes: 0 })]}>
            <ItemEventList targetType="task" targetId={mid("tasks")} />
          </Seeded>
        </Specimen>
        <Specimen label="Con más de los que caben" hint="dice cuántos quedan y hasta dónde llega el log">
          <Seeded stubs={[seedQuery(api.eventLog.porItem, { items: [EVENTOS[0]], restantes: 12 })]}>
            <ItemEventList targetType="task" targetId={mid("tasks")} />
          </Seeded>
        </Specimen>
      </SubSection>

      <Specimen
        label="No incluidos en el catálogo (dependen de datos reales o del layout completo)"
        hint="SystemsSidebar completo, FocusTimerWidget (sólo visible con timer activo), vistas completas de calendario, editor Tiptap vivo y command palette global"
        className="border-solid bg-muted/30"
      >
        <p className="text-sm text-muted-foreground">
          Estos se revisan en la app real. SystemsSidebar queda fuera porque es
          el layout de la app entera (la ruta activa, el plan de hoy, la paleta
          de comandos y el estado plegado guardado en el navegador); sus piezas
          sí están aquí: SystemTreeItem, SidebarUserMenu, las task cards, las
          board cards y las barras de calendario.
        </p>
      </Specimen>
    </Section>
  );
}
