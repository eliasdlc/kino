"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ENERGY_LEVEL_VALUES, FREQUENCY_VALUES, TEMPLATE_TYPE_VALUES } from "@/shared/types/enums";
import { ICON_MAP, DEFAULT_ICON } from "./system-icons";
import { SystemColorPicker, SystemIconPicker } from "./SystemPickers";
import { systemTileStyle } from "./system-tint";
import { useUpdateSystem } from "./systems.hooks";
import type { SystemTransport } from "./systems.types";


interface EditSystemDialogProps {
  system: SystemTransport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSystemDialog({ system, open, onOpenChange }: EditSystemDialogProps) {
  const { mutate: updateSystem, isPending } = useUpdateSystem();

  const [name, setName] = useState(system.name);
  const [identityStatement, setIdentityStatement] = useState(system.identityStatement ?? "");
  const [color, setColor] = useState(system.color);
  const [icon, setIcon] = useState(system.icon ?? "folder");
  const validTemplateTypes = ["academic", "project", "entrepreneurial", "personal", "custom"] as const;
  const initialTemplateType = validTemplateTypes.includes(system.templateType as typeof validTemplateTypes[number])
    ? system.templateType!
    : "custom";
  const [templateType, setTemplateType] = useState<string>(initialTemplateType);
  const [energyIdeal, setEnergyIdeal] = useState<string>(system.energyIdeal ?? "medium");
  const [expectedFrequency, setExpectedFrequency] = useState(system.expectedFrequency ?? "weekly");
  const [triggerContext, setTriggerContext] = useState(system.triggerContext ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleSave() {
    if (!name.trim() || isPending) return;
    updateSystem(
      {
        systemId: system.id,
        data: {
          name: name.trim(),
          identityStatement,
          color: color as SystemTransport["color"],
          icon,
          templateType: templateType as "academic" | "project" | "entrepreneurial" | "personal" | "custom",
          energyIdeal: energyIdeal as "high" | "medium" | "low",
          expectedFrequency,
          triggerContext,
        },
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  const PreviewIcon = ICON_MAP[icon] ?? DEFAULT_ICON;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Editar sistema</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-5">
          {/* Preview */}
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-[2.4rem] shrink-0 items-center justify-center rounded-xl" style={systemTileStyle(color)}>
              <PreviewIcon className="size-5" />
            </span>
            <span className={`text-sm font-medium ${name ? "text-foreground" : "text-muted-foreground"}`}>
              {name || "Nombre del sistema"}
            </span>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              maxLength={255}
            />
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <SystemColorPicker value={color} onChange={(c) => setColor(c as typeof color)} />
          </div>

          {/* Icon picker */}
          <div className="space-y-1.5">
            <Label>Ícono</Label>
            <SystemIconPicker value={icon} color={color} onChange={setIcon} />
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex min-h-[2.85rem] items-center gap-1.5 rounded-full text-sm font-semibold text-muted-foreground transition-colors duration-(--dur-toque) hover:text-foreground focus-ring md:pointer-fine:min-h-9"
          >
            <ChevronDown aria-hidden className={`size-4 transition-transform duration-(--dur-toque) ${showAdvanced ? "rotate-180" : ""}`} />
            {showAdvanced ? "Menos opciones" : "Más opciones"}
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Textarea
                  placeholder="¿Para qué es este sistema?"
                  value={identityStatement}
                  onChange={(e) => setIdentityStatement(e.target.value)}
                  rows={2}
                  className="resize-none"
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={templateType} onValueChange={setTemplateType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPE_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Energía</Label>
                  <Select value={energyIdeal} onValueChange={setEnergyIdeal}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENERGY_LEVEL_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Frecuencia esperada</Label>
                <Select value={expectedFrequency} onValueChange={setExpectedFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Contexto disparador</Label>
                <Input
                  placeholder="Por ejemplo: cuando llego a la oficina"
                  value={triggerContext}
                  onChange={(e) => setTriggerContext(e.target.value)}
                  maxLength={255}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isPending}>
                        {isPending ? "Guardando" : "Guardar cambios"}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
