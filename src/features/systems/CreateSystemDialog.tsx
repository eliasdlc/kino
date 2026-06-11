'use client'

import { useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
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
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { COLOR_VALUES, ENERGY_LEVEL_VALUES, FREQUENCY_VALUES, TEMPLATE_TYPE_VALUES } from "@/shared/types/enums";
import { getSystemColor } from "@/shared/utils/system-colors";
import { ICON_MAP, DEFAULT_ICON } from "./system-icons";
import type { CreateSystemInput } from "./systems.types";

const ICON_KEYS = Object.keys(ICON_MAP);

const DEFAULT_STATE = {
  name: "",
  identityStatement: "",
  color: "blue",
  icon: "folder",
  templateType: "custom",
  energyIdeal: "medium",
  expectedFrequency: "weekly",
  triggerContext: "",
};

export function CreateSystemDialog({ collapsed }: { collapsed?: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(DEFAULT_STATE.name);
  const [identityStatement, setIdentityStatement] = useState(DEFAULT_STATE.identityStatement);
  const [color, setColor] = useState(DEFAULT_STATE.color);
  const [icon, setIcon] = useState(DEFAULT_STATE.icon);
  const [templateType, setTemplateType] = useState(DEFAULT_STATE.templateType);
  const [energyIdeal, setEnergyIdeal] = useState(DEFAULT_STATE.energyIdeal);
  const [expectedFrequency, setExpectedFrequency] = useState(DEFAULT_STATE.expectedFrequency);
  const [triggerContext, setTriggerContext] = useState(DEFAULT_STATE.triggerContext);

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setName(DEFAULT_STATE.name);
      setIdentityStatement(DEFAULT_STATE.identityStatement);
      setColor(DEFAULT_STATE.color);
      setIcon(DEFAULT_STATE.icon);
      setTemplateType(DEFAULT_STATE.templateType);
      setEnergyIdeal(DEFAULT_STATE.energyIdeal);
      setExpectedFrequency(DEFAULT_STATE.expectedFrequency);
      setTriggerContext(DEFAULT_STATE.triggerContext);
      setShowAdvanced(false);
      setError(null);
    }
  }

  async function handleCreateSystem() {
    if (!name.trim() || isPending) return;
    setIsPending(true);
    try {
      const data: CreateSystemInput = {
        name: name.trim(),
        identityStatement,
        color: color as CreateSystemInput["color"],
        icon,
        templateType: templateType as CreateSystemInput["templateType"],
        energyIdeal: energyIdeal as CreateSystemInput["energyIdeal"],
        expectedFrequency,
        triggerContext,
      };
      const res = await fetch("/api/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("No se pudo crear el sistema");
      await queryClient.invalidateQueries({ queryKey: ["systems"] });
      handleOpenChange(false);
    } catch (e) {
      setError((e as Error).message || "Ocurrió un error inesperado");
    } finally {
      setIsPending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleCreateSystem();
  }

  const PreviewIcon = ICON_MAP[icon] ?? DEFAULT_ICON;
  const cls = getSystemColor(color);

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="size-4 shrink-0" />
          {!collapsed && <span className="ml-1.5">Nuevo sistema</span>}
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Crear sistema</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-5">
          {/* Preview */}
          <div className={`flex items-center gap-3 p-3 rounded-lg bg-${cls}/10 border border-border/50`}>
            <div className={`p-2 rounded-md bg-${cls}/10`}>
              <PreviewIcon className={`size-5 text-${cls}`} />
            </div>
            <span className={`text-sm font-medium ${name ? "text-foreground" : "text-muted-foreground"}`}>
              {name || "Nombre del sistema"}
            </span>
          </div>

          {/* Name */}
          <div className="space-y-1.5 flex flex-col gap-2">
            <Label>Nombre</Label>
            <Input
              autoFocus
              placeholder="E.g. Work, Studies, Health..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Color picker */}
          <div className="space-y-1.5 flex flex-col gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-3 justify-center">
              {COLOR_VALUES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`size-6 rounded-full transition-all bg-${getSystemColor(c)} ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Icon picker */}
          <div className="space-y-1.5 flex flex-col gap-2">
            <Label>Ícono</Label>
            <div className="grid grid-cols-10 gap-1">
              {ICON_KEYS.map((key) => {
                const IconComponent = ICON_MAP[key];
                return (
                  <button
                    key={key}
                    onClick={() => setIcon(key)}
                    className={`p-1.5 rounded-md transition-colors flex items-center justify-center ${
                      icon === key
                        ? `bg-${cls}/10 text-${cls}`
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                    title={key}
                  >
                    <IconComponent className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`size-3.5 transition-transform duration-150 ${showAdvanced ? "rotate-180" : ""}`} />
            {showAdvanced ? "Menos opciones" : "Más opciones"}
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-1.5 flex flex-col gap-2">
                <Label>Descripción</Label>
                <Textarea
                  placeholder="¿Para qué es este sistema? ¿Qué identidad representa?"
                  value={identityStatement}
                  onChange={(e) => setIdentityStatement(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 flex flex-col gap-2">
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

                <div className="space-y-1.5 flex flex-col gap-2">
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

              <div className="space-y-1.5 flex flex-col gap-2">
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

              <div className="space-y-1.5 flex flex-col gap-2">
                <Label>Contexto disparador</Label>
                <Input
                  placeholder="E.g. When I get to the office, when I wake up..."
                  value={triggerContext}
                  onChange={(e) => setTriggerContext(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleCreateSystem} disabled={!name.trim() || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
            Crear sistema
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
