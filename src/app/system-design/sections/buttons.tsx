"use client";

import { useState } from "react";
import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Segmented } from "@/components/ui/segmented";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Trash2, ChevronDown, Sparkles, Play } from "lucide-react";

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const TEXT_SIZES = ["xs", "sm", "default", "lg"] as const;
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;
const BADGES = ["default", "warn", "ok", "secondary", "destructive", "outline", "ghost", "link"] as const;

const TEMAS = [
  { value: "sistema", label: "Sistema" },
  { value: "claro", label: "Claro" },
  { value: "oscuro", label: "Oscuro" },
] as const;
const VISTAS = [
  { value: "lista", label: "Lista" },
  { value: "calendario", label: "Calendario" },
] as const;

export function ButtonsSection() {
  const [tema, setTema] = useState<(typeof TEMAS)[number]["value"]>("claro");
  const [vista, setVista] = useState<(typeof VISTAS)[number]["value"]>("lista");

  return (
    <Section
      id="botones"
      number="05"
      title="Botones, segmentos, pestañas, badges y vacíos"
      description="Toda acción es una pastilla de 2.85rem (el táctil mínimo) que se encoge a .97 al tocar; la primaria mide 3.2rem y se distingue por el ámbar, sin sombra ni halo. Un solo foco visible, el anillo del acento. Todo estado (seleccionado, hecho) también es pastilla o círculo, y se dice en tinta, no en ámbar."
    >
      <SubSection
        title="Matriz de variantes y tamaños"
        description="xs y sm miden 2.85rem en el teléfono y sólo encogen desde md: ningún botón queda bajo 48 px. Mira esta tabla a 393 de ancho para verlos al táctil."
      >
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 font-mono text-xs font-medium text-muted-foreground">
                  variant \ size
                </th>
                {TEXT_SIZES.map((s) => (
                  <th key={s} className="p-3 font-mono text-xs font-medium text-muted-foreground">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((v) => (
                <tr key={v} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{v}</td>
                  {TEXT_SIZES.map((s) => (
                    <td key={s} className="p-3">
                      <Button variant={v} size={s}>
                        Acción
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SubSection>

      <SubSection title="Botones de icono">
        <SpecimenGrid cols={3}>
          <Specimen label="Tamaños icon" hint="icon-xs, icon-sm, icon, icon-lg: círculos de 2.85rem en el teléfono">
            {ICON_SIZES.map((s) => (
              <Button key={s} variant="outline" size={s} aria-label="Añadir">
                <Plus />
              </Button>
            ))}
          </Specimen>
          <Specimen label="Icono y texto" hint="el svg hereda 1.25rem (0.875rem en xs)">
            <Button>
              <Plus /> Nueva tarea
            </Button>
            <Button variant="outline">
              Opciones <ChevronDown />
            </Button>
          </Specimen>
          <Specimen label="Las acciones de una tarea" hint="secundaria y ghost con hairline, como en el detalle">
            <Button variant="secondary">
              <Play /> Foco 50 min
            </Button>
            <Button variant="outline">A mañana</Button>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Estados">
        <SpecimenGrid cols={4}>
          <Specimen label="Deshabilitado" hint="opacity-50, sin eventos">
            <Button disabled>Guardar</Button>
            <Button variant="outline" disabled>
              Cancelar
            </Button>
          </Specimen>
          <Specimen label="Guardando" hint="texto de estado y disabled; nunca un spinner">
            <Button disabled aria-busy>Guardando</Button>
          </Specimen>
          <Specimen label="Foco" hint="Tab: el anillo del acento con 2 px de aire (focus-ring)">
            <Button variant="outline">Tabúlame</Button>
          </Specimen>
          <Specimen label="Destructivo" hint="carmesí tintado: sólo lo irreversible">
            <Button variant="destructive">
              <Trash2 /> Eliminar
            </Button>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Segmented (segmento)"
        description="De dos a cuatro opciones sobre sf2, cada una de 2.85rem, la elegida en tinta. Grupo de radios: una opción activa siempre y las flechas eligen. Cuándo usar: para elegir un valor entre dos y cuatro (tema, tramo, Lista o Calendario) sin cambiar de pantalla. Para moverse entre secciones de una misma pantalla, Tabs."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Tres opciones" hint={`value="${tema}"`}>
            <Segmented aria-label="Tema" value={tema} onValueChange={setTema} options={TEMAS} />
          </Specimen>
          <Specimen label="Dos opciones" hint={`value="${vista}"`}>
            <Segmented aria-label="Vista" value={vista} onValueChange={setVista} options={VISTAS} />
          </Specimen>
          <Specimen label="Ancho completo" hint="className=w-full y las opciones reparten">
            <Segmented
              aria-label="Tramo"
              value="manana"
              onValueChange={() => {}}
              options={[
                { value: "manana", label: "Mañana" },
                { value: "tarde", label: "Tarde" },
                { value: "noche", label: "Noche" },
              ]}
              className="w-full *:flex-1"
            />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Tabs (pestañas)"
        description="Cuándo usar: para moverse entre secciones de una misma pantalla (Manuscritos, Tareas, Estudio, Codex). La activa se dice en tinta, igual que en Segmented: estar en una vista es un estado, no una acción. `line` son las pestañas-palabra de Diario, subrayadas sobre un hairline; `default` es el segmento pill para el escritorio."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Línea" hint='variant="line": palabras de 2.85rem, subrayado en ámbar'>
            <Tabs defaultValue="manuscritos" className="w-full">
              <TabsList variant="line">
                <TabsTrigger value="manuscritos">Manuscritos</TabsTrigger>
                <TabsTrigger value="tareas">Tareas</TabsTrigger>
                <TabsTrigger value="estudio">Estudio</TabsTrigger>
              </TabsList>
            </Tabs>
          </Specimen>
          <Specimen label="Pill" hint="default: la activa en tinta sobre sf2">
            <Tabs defaultValue="hoy">
              <TabsList>
                <TabsTrigger value="hoy">Hoy</TabsTrigger>
                <TabsTrigger value="semana">Semana</TabsTrigger>
              </TabsList>
            </Tabs>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Badge" description="Un par tintado: el color acompaña a la palabra, nunca la sustituye. El texto es el rol mezclado con tinta (--ok-text y compañía) para contrastar 4,5 o más sobre el tinte en claro. Pastilla de 1.4rem, texto xs; no es táctil porque no es acción.">
        <SpecimenGrid cols={3}>
          <Specimen label="Variantes">
            {BADGES.map((v) => (
              <Badge key={v} variant={v}>
                {v}
              </Badge>
            ))}
          </Specimen>
          <Specimen label="Con icono" hint="svg a 0.75rem">
            <Badge>
              <Sparkles /> Sugerida
            </Badge>
            <Badge variant="warn">vencida</Badge>
            <Badge variant="ok">hecha</Badge>
          </Specimen>
          <Specimen label="Usos en Kino">
            <Badge variant="secondary">3 tareas</Badge>
            <Badge variant="outline">borrador</Badge>
            <Badge variant="destructive">se borra</Badge>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="EmptyState (estado vacío)"
        description="Un título en display, una frase en la voz y, si hay algo que hacer, una acción. Sin ilustración: una página en blanco invita a escribir. Va en la columna de texto. Cuándo usar: una lista o una página sin contenido, siempre con la acción si existe; nunca para un error (lleva mensaje y causa) ni para una carga (es un esqueleto)."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Con acción">
            <EmptyState
              title="Nada para hoy"
              description="El plan se llena desde Tareas o con el orbe."
              action={<Button>Añadir una tarea</Button>}
            />
          </Specimen>
          <Specimen label="Sin acción" hint="no queda hueco">
            <EmptyState title="Sin vencidas" description="Hoy no debes nada." />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Kbd" description="Atajos de teclado en menús, tooltips y command palette.">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-border p-4">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            Buscar <Kbd>Ctrl K</Kbd> o <Kbd>Cmd K</Kbd>
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            Captura rápida <Kbd>Q</Kbd>
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            Navegar <Kbd>G</Kbd>
            <Kbd>D</Kbd>
          </span>
        </div>
      </SubSection>
    </Section>
  );
}
