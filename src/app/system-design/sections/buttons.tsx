"use client";

import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Loader2, Plus, Trash2, ChevronDown, Sparkles } from "lucide-react";

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const TEXT_SIZES = ["xs", "sm", "default", "lg"] as const;
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

export function ButtonsSection() {
  return (
    <Section
      id="botones"
      number="05"
      title="Botones, badges y teclas"
      description="Button tiene 6 variantes × 8 tamaños (4 de texto + 4 de icono). Estados: hover, focus (Tab), active (pressed baja 1px), disabled y loading. Badge comparte variantes con forma pill."
    >
      <SubSection title="Matriz de variantes × tamaños">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40">
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
          <Specimen label="Tamaños icon" hint="icon-xs · icon-sm · icon · icon-lg">
            {ICON_SIZES.map((s) => (
              <Button key={s} variant="outline" size={s} aria-label="Añadir">
                <Plus />
              </Button>
            ))}
          </Specimen>
          <Specimen label="Icono + texto" hint="el svg hereda size-5 (3.5 en xs)">
            <Button>
              <Plus /> Nueva tarea
            </Button>
            <Button variant="outline">
              Opciones <ChevronDown />
            </Button>
          </Specimen>
          <Specimen label="Destructivo con icono">
            <Button variant="destructive">
              <Trash2 /> Eliminar
            </Button>
            <Button variant="ghost" size="icon" aria-label="Eliminar">
              <Trash2 />
            </Button>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Estados">
        <SpecimenGrid cols={4}>
          <Specimen label="Disabled" hint="opacity-50, sin eventos">
            <Button disabled>Guardar</Button>
            <Button variant="outline" disabled>
              Cancelar
            </Button>
          </Specimen>
          <Specimen label="Loading" hint="Loader2 + animate-spin + disabled">
            <Button disabled>
              <Loader2 className="animate-spin" /> Guardando…
            </Button>
          </Specimen>
          <Specimen label="Focus" hint="Tab para ver ring-3 ring-ring/50">
            <Button variant="outline">Tabúlame</Button>
          </Specimen>
          <Specimen label="aria-invalid" hint="borde + ring destructivo">
            <Button variant="outline" aria-invalid>
              Campo inválido
            </Button>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Badge" description="Forma pill (rounded-4xl), altura fija h-5, texto xs.">
        <SpecimenGrid cols={3}>
          <Specimen label="Variantes">
            {VARIANTS.map((v) => (
              <Badge key={v} variant={v}>
                {v}
              </Badge>
            ))}
          </Specimen>
          <Specimen label="Con icono" hint="svg forzado a size-3">
            <Badge>
              <Sparkles /> Sugerida
            </Badge>
            <Badge variant="destructive">
              <Trash2 /> Vencida
            </Badge>
          </Specimen>
          <Specimen label="Usos típicos en Kino">
            <Badge variant="destructive">critical</Badge>
            <Badge variant="secondary">3 tareas</Badge>
            <Badge variant="outline">borrador</Badge>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Kbd" description="Atajos de teclado en menús, tooltips y command palette.">
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border p-4">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            Command palette <Kbd>⌘K</Kbd>
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            Quick add <Kbd>Q</Kbd>
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
