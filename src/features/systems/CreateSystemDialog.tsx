'use client'

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

export function CreateSystemDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPending, setIsPending] = useState(false);

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
      if (!res.ok) throw new Error("Failed to create system");
      await queryClient.invalidateQueries({ queryKey: ["systems"] });
      handleOpenChange(false);
    } finally {
      setIsPending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleCreateSystem();
  }

  const PreviewIcon = ICON_MAP[icon] ?? DEFAULT_ICON;
  const { bgSubtle, text: textColor } = getSystemColor(color);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">+ New system</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create system</DialogTitle>
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
          <div className="space-y-1.5 flex flex-col gap-2">
            <Label>Name</Label>
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
          <div className="space-y-1.5 flex flex-col gap-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-10 gap-1">
              {ICON_KEYS.map((key) => {
                const IconComponent = ICON_MAP[key];
                return (
                  <button
                    key={key}
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
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`size-3.5 transition-transform duration-150 ${showAdvanced ? "rotate-180" : ""}`} />
            {showAdvanced ? "Less options" : "More options"}
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-1.5 flex flex-col gap-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="What is this system for? What identity does it represent?"
                  value={identityStatement}
                  onChange={(e) => setIdentityStatement(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 flex flex-col gap-2">
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

                <div className="space-y-1.5 flex flex-col gap-2">
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

              <div className="space-y-1.5 flex flex-col gap-2">
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

              <div className="space-y-1.5 flex flex-col gap-2">
                <Label>Trigger context</Label>
                <Input
                  placeholder="E.g. When I get to the office, when I wake up..."
                  value={triggerContext}
                  onChange={(e) => setTriggerContext(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreateSystem} disabled={!name.trim() || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
            Create system
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
