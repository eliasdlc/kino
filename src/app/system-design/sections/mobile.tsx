"use client";

import type { ReactNode } from "react";
import { Section, SubSection, Specimen } from "../helpers";
import { MobileHeader } from "@/components/MobileHeader";
import { BottomNav } from "@/components/BottomNav";
import { PageError } from "@/components/PageError";
import { PageHeaderSkeleton, PageSkeleton, RowsSkeleton, TitleSkeleton } from "@/components/Skeletons";
import { InstallStrip } from "@/components/InstallPrompt";
import TasksLoading from "@/app/(app)/tasks/loading";

/**
 * Un marco de teléfono de 360 px. La cabecera y el pie son `md:hidden` y el
 * pie es `fixed`; aquí se fuerzan visibles y en flujo para poder mirarlos en
 * escritorio.
 */
function Telefono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`w-[360px] shrink-0 overflow-hidden rounded-[1.5rem] border border-border bg-background [&_header]:flex! [&_nav[aria-label=Secciones]]:static! [&_nav[aria-label=Secciones]]:grid! ${className}`}
    >
      {children}
    </div>
  );
}

function Relleno({ alto = "h-28" }: { alto?: string }) {
  return (
    <div className={`flex ${alto} items-center justify-center font-voice text-sm italic text-muted-foreground`}>
      la página
    </div>
  );
}

export function MobileSection() {
  return (
    <Section
      id="mobile"
      number="14"
      title="Shell"
      description="El chrome de la app: la cabecera corrida y el pie de palabras del teléfono, los esqueletos con la forma de cada pantalla y la pantalla de problema. Todo es papel con hairline: sin vidrio, sin desenfoque, sin sombra."
    >
      <SubSection
        title="El pie de palabras"
        description="Cuatro destinos sin icono (Hoy, Tareas, Sistemas, Bandeja), Buscar como quinta palabra que abre la paleta, y el orbe de crear aparte. La activa va en ámbar con un punto debajo; las demás en mute. Cada palabra mide 2.85rem o más; el pie suma el área segura de abajo y toca el borde a propósito."
      >
        <div className="flex flex-wrap gap-6">
          <Specimen label="Hoy activa" hint='rutaActual="/dashboard"'>
            <Telefono>
              <Relleno />
              <BottomNav rutaActual="/dashboard" />
            </Telefono>
          </Specimen>
          <Specimen label="Sistemas activa, también dentro de un sistema" hint='rutaActual="/systems/abc"'>
            <Telefono>
              <Relleno />
              <BottomNav rutaActual="/systems/abc" />
            </Telefono>
          </Specimen>
          <Specimen label="En 320 px, el mínimo" hint="las columnas reparten el ancho; el recorte de margen por debajo de 360 px lo decide el viewport, no este marco">
            <Telefono className="w-[320px]!">
              <Relleno />
              <BottomNav rutaActual="/tasks" />
            </Telefono>
          </Specimen>
          <Specimen label="Con el teclado abierto" hint="visualViewport encogido más de 150 px, o foco en un campo con puntero grueso">
            <Telefono>
              <Relleno alto="h-20" />
              <div className="border-t border-border px-5 py-3 font-voice text-sm italic text-body">
                El pie no se pinta y `--kino-bottom-chrome` vale cero: la página llega hasta el teclado.
              </div>
            </Telefono>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="La cabecera corrida"
        description="En una pantalla raíz, la marca a la izquierda y la puerta a Ajustes a la derecha, un botón de 48 px con la palabra. En una anidada, «‹ padre» con el nombre del padre en tinta y el chevron en mute: el ámbar queda para la palabra activa del pie. El título de la pantalla no está aquí: el único h1 va con la página."
      >
        <div className="flex flex-wrap gap-6">
          <Specimen label="Raíz: Tareas" hint='rutaActual="/tasks"'>
            <Telefono>
              <MobileHeader rutaActual="/tasks" />
              <Relleno alto="h-16" />
            </Telefono>
          </Specimen>
          <Specimen label="Anidada: un sistema" hint='rutaActual="/systems/abc"'>
            <Telefono>
              <MobileHeader rutaActual="/systems/abc" />
              <Relleno alto="h-16" />
            </Telefono>
          </Specimen>
          <Specimen label="Anidada: Ajustes vuelve a Hoy" hint='rutaActual="/settings"'>
            <Telefono>
              <MobileHeader rutaActual="/settings" />
              <Relleno alto="h-16" />
            </Telefono>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Esqueletos"
        description="Cada loading.tsx copia la rejilla y los cantos de su pantalla, con filas de margen y sin latido. El genérico (PageSkeleton) es el fallback del Suspense del shell para una ruta que llegue sin el suyo."
      >
        <div className="flex flex-wrap gap-6">
          <Specimen label="Tareas esperando" hint="app/(app)/tasks/loading.tsx">
            <Telefono>
              <MobileHeader rutaActual="/tasks" />
              <TasksLoading />
            </Telefono>
          </Specimen>
          <Specimen label="Genérico" hint="PageSkeleton">
            <Telefono>
              <PageSkeleton />
            </Telefono>
          </Specimen>
          <Specimen label="Cabecera de pantalla esperando" hint="PageHeaderSkeleton accion voz: la misma rejilla que PageHeader">
            <div className="w-[360px] px-5 py-4">
              <PageHeaderSkeleton accion voz />
            </div>
          </Specimen>
          <Specimen label="Piezas" hint="TitleSkeleton, RowsSkeleton con numeral">
            <div className="w-[360px] px-5 py-4">
              <TitleSkeleton voz />
              <div className="mt-4">
                <RowsSkeleton rows={3} margin="numeral" />
              </div>
            </div>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Instalar"
        description="La tira que ofrece instalar la app cuando el navegador lo permite: papel con hairline encima del pie, el título en display, una pastilla Instalar y Descartar a 48 px. Se descarta para siempre en este dispositivo."
      >
        <Specimen label="Tira de instalar en el teléfono" hint="InstallStrip, fijo={false}">
          <div className="w-[393px]">
            <InstallStrip onInstall={() => {}} onDismiss={() => {}} fijo={false} />
          </div>
        </Specimen>
      </SubSection>

      <SubSection
        title="La pantalla de problema"
        description="Un título en display, una frase en la voz que dice qué pasó y qué no se perdió, Reintentar y volver a Hoy. Sin traza: sólo la referencia, en mono y en mute."
      >
        <Specimen label="error.tsx del grupo de la app" hint="PageError">
          <Telefono>
            <MobileHeader rutaActual="/tasks" />
            <PageError
              title="Esta pantalla no se pudo abrir"
              voz="El resto sigue en su sitio y no perdiste nada. Vuelve a intentarlo o pasa a Hoy."
              reset={() => {}}
              digest="a1b2c3d4"
            />
          </Telefono>
        </Specimen>
      </SubSection>
    </Section>
  );
}
