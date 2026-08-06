"use client";

import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BreadcrumbSkeleton,
  CardSkeleton,
  TaskCardSkeleton,
} from "@/components/Skeletons";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Inbox, Plus } from "lucide-react";

export function ContentSection() {
  return (
    <Section
      id="contenido"
      number="08"
      title="Contenido y datos"
      description="Superficies de contenido: cards, tabs, avatares, separadores, breadcrumbs, skeletons de carga y el patrón de estado vacío."
    >
      <SubSection title="Card">
        <SpecimenGrid cols={2}>
          <Specimen label="Completa" hint="Header + Action + Content + Footer">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Plan de hoy</CardTitle>
                <CardDescription>4 tareas alineadas con tu energía</CardDescription>
                <CardAction>
                  <Button variant="ghost" size="icon-sm" aria-label="Opciones">
                    <MoreHorizontal />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Cuerpo de la card. Padding y tipografía estándar.
                </p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Empezar</Button>
                <Button size="sm" variant="ghost">
                  Reordenar
                </Button>
              </CardFooter>
            </Card>
          </Specimen>
          <Specimen label="Simple" hint="solo Content">
            <Card className="w-full">
              <CardContent>
                <p className="text-sm">
                  Card mínima para agrupar contenido sin encabezado.
                </p>
              </CardContent>
            </Card>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Tabs">
        <SpecimenGrid cols={2}>
          <Specimen label="Default" hint="fondo muted (segmented)">
            <Tabs defaultValue="backlog" className="w-full">
              <TabsList>
                <TabsTrigger value="backlog">Backlog</TabsTrigger>
                <TabsTrigger value="planning">Planning</TabsTrigger>
                <TabsTrigger value="action">Action</TabsTrigger>
              </TabsList>
              <TabsContent value="backlog" className="pt-3 text-sm text-muted-foreground">
                Ideas sin compromiso.
              </TabsContent>
              <TabsContent value="planning" className="pt-3 text-sm text-muted-foreground">
                Semana y mañana.
              </TabsContent>
              <TabsContent value="action" className="pt-3 text-sm text-muted-foreground">
                Hoy y en curso.
              </TabsContent>
            </Tabs>
          </Specimen>
          <Specimen label="Line" hint='variant="line"'>
            <Tabs defaultValue="a" className="w-full">
              <TabsList variant="line">
                <TabsTrigger value="a">Resumen</TabsTrigger>
                <TabsTrigger value="b">Actividad</TabsTrigger>
                <TabsTrigger value="c">Ajustes</TabsTrigger>
              </TabsList>
              <TabsContent value="a" className="pt-3 text-sm text-muted-foreground">
                Variante subrayada, sin fondo.
              </TabsContent>
              <TabsContent value="b" className="pt-3 text-sm text-muted-foreground">
                Contenido B.
              </TabsContent>
              <TabsContent value="c" className="pt-3 text-sm text-muted-foreground">
                Contenido C.
              </TabsContent>
            </Tabs>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Avatar">
        <SpecimenGrid cols={4}>
          <Specimen label="Fallback" hint="iniciales cuando no hay imagen">
            <Avatar>
              <AvatarImage src="/no-existe.png" alt="Elias" />
              <AvatarFallback>EA</AvatarFallback>
            </Avatar>
          </Specimen>
          <Specimen label="Con badge" hint="indicador de estado">
            <Avatar>
              <AvatarFallback>EA</AvatarFallback>
              <AvatarBadge className="bg-green-500" />
            </Avatar>
          </Specimen>
          <Specimen label="Grupo">
            <AvatarGroup>
              <Avatar>
                <AvatarFallback>EA</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>MC</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JR</AvatarFallback>
              </Avatar>
              <AvatarGroupCount>+3</AvatarGroupCount>
            </AvatarGroup>
          </Specimen>
          <Specimen label="Tamaños" hint="size-* sobre Avatar">
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px]">EA</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>EA</AvatarFallback>
            </Avatar>
            <Avatar className="size-12">
              <AvatarFallback>EA</AvatarFallback>
            </Avatar>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Separator y Breadcrumb">
        <SpecimenGrid cols={3}>
          <Specimen label="Separator horizontal">
            <div className="w-full space-y-3 text-sm">
              <p>Bloque superior</p>
              <Separator />
              <p>Bloque inferior</p>
            </div>
          </Specimen>
          <Specimen label="Separator vertical">
            <div className="flex h-8 items-center gap-3 text-sm">
              <span>Hoy</span>
              <Separator orientation="vertical" />
              <span>Semana</span>
              <Separator orientation="vertical" />
              <span>Backlog</span>
            </div>
          </Specimen>
          <Specimen label="PageBreadcrumb" hint="último item en foreground">
            <PageBreadcrumb
              items={[
                { label: "Sistemas", href: "#" },
                { label: "Universidad", href: "#" },
                { label: "Cálculo II" },
              ]}
            />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Skeletons"
        description="Skeleton base + composiciones de components/Skeletons.tsx. Cada vista debe cargar con el skeleton que replica su layout final."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Skeleton base">
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Specimen>
          <Specimen label="BreadcrumbSkeleton" hint="segments={3}">
            <BreadcrumbSkeleton segments={3} />
          </Specimen>
          <Specimen label="TaskCardSkeleton">
            <div className="w-full">
              <TaskCardSkeleton />
            </div>
          </Specimen>
          <Specimen label="CardSkeleton" hint="wrapper de sección" className="items-stretch">
            <CardSkeleton className="w-full">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </CardSkeleton>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Estado vacío"
        description="Patrón: icono muted, mensaje corto, acción primaria. Centrado en su contenedor."
      >
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Nada por aquí todavía</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Crea tu primera tarea para empezar el día.
            </p>
          </div>
          <Button size="sm">
            <Plus /> Nueva tarea
          </Button>
        </div>
      </SubSection>

      <SubSection title="Estados de badge en contexto" description="Combinaciones frecuentes de metadatos.">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-4">
          <Badge variant="destructive">Vencida</Badge>
          <Badge variant="secondary">Hoy</Badge>
          <Badge variant="outline">Mañana</Badge>
          <Badge variant="ghost">Backlog</Badge>
          <Badge>Sugerida</Badge>
        </div>
      </SubSection>
    </Section>
  );
}
