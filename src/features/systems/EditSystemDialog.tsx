"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COLOR_VALUES, ENERGY_LEVEL_VALUES, FREQUENCY_VALUES, TEMPLATE_TYPE_VALUES } from "@/shared/types/enums";
import { getSystemColor } from "@/shared/utils/system-colors";
import { ICON_MAP, DEFAULT_ICON } from "./system-icons";
import { useUpdateSystem } from "./systems.hooks";
import type { System } from "./systems.types";

const ICON_KEYS = Object.keys(ICON_MAP);

interface EditSystemDialogProps {
  system: System;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSystemDialog({ system, open, onOpenChange }: EditSystemDialogProps) {
  const { mutate: updateSystem, isPending } = useUpdateSystem();

  const [name, setName] = useState(system.name);
  const [identityStatement, setIdentityStatement] = useState(system.identityStatement ?? "");
  const [color, setColor] = useState(system.color);
  const [icon, setIcon] = useState(system.icon ?? "folder");
  const validTemplateTypes = ["academic", "professional", "entrepreneurial", "personal", "custom"] as const;
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
          color: color as System["color"],
          icon,
          templateType: templateType as "academic" | "professional" | "entrepreneurial" | "personal" | "custom",
          energyIdeal: energyIdeal as "high" | "medium" | "low",
          expectedFrequency,
          triggerContext,
        },
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  const PreviewIcon = ICON_MAP[icon] ?? DEFAULT_ICON;
  const { bgSubtle, text: textColor } = getSystemColor(color);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit system</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Preview */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${bgSubtle} border border-border/50`}>
            <div className={`p-2 rounded-md ${bgSubtle}`}>
              <PreviewIcon className={`size-5 ${textColor}`} />
            </div>
            <span className={`text-sm font-medium ${name ? "text-foreground" : "text-muted-foreground"}`}>
              {name || "System name"}
            </span>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name</Label>
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
            <div className="flex flex-wrap gap-3 justify-center">
              {COLOR_VALUES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`size-6 rounded-full transition-all ${getSystemColor(c).bg} ${
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
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-10 gap-1">
              {ICON_KEYS.map((key) => {
                const IconComponent = ICON_MAP[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    className={`p-1.5 rounded-md transition-colors flex items-center justify-center ${
                      icon === key
                        ? `${bgSubtle} ${textColor}`
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
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`size-3.5 transition-transform duration-150 ${showAdvanced ? "rotate-180" : ""}`} />
            {showAdvanced ? "Less options" : "More options"}
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  placeholder="What is this system for?"
                  value={identityStatement}
                  onChange={(e) => setIdentityStatement(e.target.value)}
                  rows={2}
                  className="resize-none"
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
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
                  <Label>Energy</Label>
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
                <Label>Expected frequency</Label>
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
                <Label>Trigger context</Label>
                <Input
                  placeholder="E.g. When I get to the office..."
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
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
