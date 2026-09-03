"use client";

import { Section, SubSection, Specimen, Seeded, ClientOnly } from "../helpers";
import { makeSystem, makeTask, daysFromNow, MOCK_SYSTEM_ID } from "../mock-data";
import { SystemCard } from "@/features/systems/SystemCard";
import { PhysicalCard } from "@/components/PhysicalCard";
import { TaskCardFor } from "@/features/tasks/cards/TaskCardFor";
import {
  SidebarProvider,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { LayoutGrid, Inbox, Calendar, BookOpen, Rocket } from "lucide-react";
import { GithubRepoPanelView } from "@/features/github-sync/GithubRepoPanelView";
import { AccountSection } from "@/features/account/AccountSection";
import { SessionsSection } from "@/features/account/SessionsSection";
import { DangerZoneSection } from "@/features/account/DangerZoneSection";
import { accountKeys, type ActiveSessionDto } from "@/features/account/account.hooks";
import type { AccountOverview } from "@/features/account/account.service";

const ACCOUNT_WITH_PASSWORD: AccountOverview = {
  name: "Elias De La Cruz",
  email: "elias@kino.dev",
  emailVerified: true,
  hasPassword: true,
  providers: [],
};

const ACCOUNT_GOOGLE_ONLY: AccountOverview = {
  name: "Elias De La Cruz",
  email: "elias@gmail.com",
  emailVerified: false,
  hasPassword: false,
  providers: ["google"],
};

const HOUR = 60 * 60 * 1000;

/** Fechas relativas al momento de pintar: el specimen se monta sólo en cliente. */
function mockSessions(): ActiveSessionDto[] {
  const now = Date.now();
  return [
    {
      id: "s-actual",
      current: true,
      device: { browser: "Chrome", os: "Linux", mobile: false },
      ipAddress: "190.166.12.4",
      createdAt: new Date(now - 30 * HOUR).toISOString(),
      lastActiveAt: new Date(now - 2 * 60 * 1000).toISOString(),
    },
    {
      id: "s-telefono",
      current: false,
      device: { browser: "Safari", os: "iOS", mobile: true },
      ipAddress: "190.166.12.9",
      createdAt: new Date(now - 5 * 24 * HOUR).toISOString(),
      lastActiveAt: new Date(now - 6 * HOUR).toISOString(),
    },
  ];
}

const noop = () => {};

export function KinoSection() {
  return (
    <Section
      id="kino"
      number="09"
      title="Componentes Kino"
      description="Componentes propios del producto, renderizados con datos de muestra: son los mismos componentes de producción, así que cualquier cambio en ellos se refleja aquí."
    >
      <SubSection
        title="SystemCard"
        description="La card física de /systems: cuerpo del color del sistema, cremallera con hover, banda de etiqueta. Estados: normal, stale (anillo ámbar) y hover (levita + abre cremallera)."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <SystemCard
            system={makeSystem({ name: "Universidad", color: "blue", templateType: "academic" })}
            onEdit={noop}
            onDelete={noop}
          />
          <SystemCard
            system={makeSystem({
              name: "Side project",
              color: "purple",
              templateType: "project",
              activeTaskCount: 3,
            })}
            onEdit={noop}
            onDelete={noop}
          />
          <SystemCard
            system={makeSystem({
              name: "Novela",
              color: "orange",
              templateType: "writing",
              activeTaskCount: 1,
            })}
            onEdit={noop}
            onDelete={noop}
          />
          <SystemCard
            system={makeSystem({
              name: "Salud",
              color: "green",
              templateType: "personal",
              stale: true,
              activeTaskCount: 0,
            })}
            onEdit={noop}
            onDelete={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="PhysicalCard (marco genérico)"
        description="El marco reutilizable de objeto físico: superficie cuadrada, clip redondeado 20/28px, hover lift. El cuerpo visual lo pone cada consumidor (sistemas, folders…)."
      >
        <div className="grid max-w-md grid-cols-2 gap-4">
          <PhysicalCard ariaLabel="Ejemplo simple" onClick={noop}>
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500 to-teal-700" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-card p-3">
              <p className="text-xs font-semibold">Cuerpo libre</p>
            </div>
          </PhysicalCard>
          <PhysicalCard ariaLabel="Ejemplo plano" onClick={noop}>
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <p className="text-sm text-muted-foreground">children</p>
            </div>
          </PhysicalCard>
        </div>
      </SubSection>

      <SubSection
        title="Task cards — estados"
        description="DefaultTaskCard (sistemas custom) en todos sus estados de scheduling y prioridad. El checkbox y el expandir son interactivos."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[
            makeTask({ id: "t-1", title: "Tarea normal (today)", status: "today" }),
            makeTask({
              id: "t-2",
              title: "Prioridad crítica",
              priority: "critical",
              status: "today",
            }),
            makeTask({ id: "t-3", title: "Prioridad alta", priority: "high", status: "week" }),
            makeTask({
              id: "t-4",
              title: "Vencida hace dos días",
              dueDate: daysFromNow(-2),
              status: "today",
            }),
            makeTask({
              id: "t-5",
              title: "Con entrega próxima y descripción",
              description: "Expandible: haz clic para ver la descripción completa.",
              dueDate: daysFromNow(2),
              status: "tomorrow",
            }),
            makeTask({
              id: "t-6",
              title: "Completada",
              status: "done",
              completedAt: new Date().toISOString(),
            }),
            makeTask({ id: "t-7", title: "Archivada", status: "archived" }),
            makeTask({
              id: "t-8",
              title: "Idea capturada",
              taskType: "idea",
              status: "backlog",
            }),
            makeTask({
              id: "t-9",
              title: "Evento: examen final",
              taskType: "event",
              startDate: daysFromNow(5),
              dueDate: daysFromNow(5),
              status: "week",
              metadata: { eventSubtype: "exam" },
            }),
            makeTask({
              id: "t-10",
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
        title="Task cards — por arquetipo"
        description="La misma tarea renderizada por cada card de arquetipo (TaskCardFor decide el layout según systemType)."
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
                  id: `arch-${type}`,
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
        title="GithubRepoPanel — estados (KIN-135)"
        description="Barra del board de un sistema `project` para enlazar un repositorio y refrescar sus issues. Sólo la monta la vista project: ningún otro arquetipo ve esta integración. Tres estados según haya cuenta conectada y repositorio elegido, más el token caducado, que degrada con aviso en vez de romper el board."
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
          <Specimen label="Token revocado" hint="degrada, no rompe">
            <GithubRepoPanelView
              state={{ kind: "linked", repo: { owner: "eliasdlc", repo: "kino" }, revoked: true }}
            />
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Cuenta y sesiones (Ajustes)"
        description="Gestión de la cuenta desde Ajustes: nombre editable en línea, correo con cambio verificado en la dirección nueva, contraseña sólo cuando existe, sesiones abiertas y la zona de peligro. Sin contraseña (Google o GitHub) la fila dice con qué se entra en vez de ofrecer un cambio que fallaría."
      >
        <div className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
          <Specimen label="Cuenta con contraseña" hint="hasPassword: true">
            <Seeded seed={(qc) => qc.setQueryData(accountKeys.overview, ACCOUNT_WITH_PASSWORD)}>
              <div className="w-full">
                <AccountSection />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Sólo Google, correo sin confirmar" hint="hasPassword: false · emailVerified: false">
            <Seeded seed={(qc) => qc.setQueryData(accountKeys.overview, ACCOUNT_GOOGLE_ONLY)}>
              <div className="w-full">
                <AccountSection />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Sesiones activas" hint="la actual no se puede cerrar desde la lista">
            <ClientOnly>
              <Seeded seed={(qc) => qc.setQueryData(accountKeys.sessions, mockSessions())}>
                <div className="w-full">
                  <SessionsSection />
                </div>
              </Seeded>
            </ClientOnly>
          </Specimen>
          <Specimen label="Zona de peligro" hint="confirma escribiendo el correo">
            <Seeded seed={(qc) => qc.setQueryData(accountKeys.overview, ACCOUNT_WITH_PASSWORD)}>
              <div className="w-full">
                <DangerZoneSection />
              </div>
            </Seeded>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Sidebar — primitivas"
        description="Bloques del sidebar (grupo, item activo, badge de contador, submenú). El SystemsSidebar real es server-side con datos; aquí se muestran las primitivas de ui/sidebar con las que está construido."
      >
        <SidebarProvider className="min-h-0 w-auto">
          <div className="w-64 rounded-lg border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground">
            <SidebarGroup>
              <SidebarGroupLabel>Navegación</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive>
                      <LayoutGrid /> Dashboard
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <Inbox /> Inbox
                    </SidebarMenuButton>
                    <SidebarMenuBadge>12</SidebarMenuBadge>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <Calendar /> Calendario
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Sistemas</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <BookOpen className="text-blue-500" /> Universidad
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton isActive>Cálculo II</SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton>Física I</SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <Rocket className="text-purple-500" /> Side project
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        </SidebarProvider>
      </SubSection>

      <Specimen
        label="No incluidos en el catálogo (dependen de datos reales o del layout completo)"
        hint="SystemsSidebar completo · FocusTimerWidget (solo visible con timer activo) · vistas completas de calendario/kanban · editor Tiptap vivo · command palette global"
        className="border-solid bg-muted/30"
      >
        <p className="text-sm text-muted-foreground">
          Estos se revisan en la app real; todas sus piezas (tokens, primitivas de sidebar,
          task cards, board cards, barras de calendario) están en este catálogo.
        </p>
      </Specimen>
    </Section>
  );
}
