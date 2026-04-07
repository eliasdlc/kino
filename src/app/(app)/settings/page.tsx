"use client";

import { PageWrapper, PageHeader } from "@/components/PageWrapper";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useThemeStore } from "@/components/ThemeProvider";
import { Separator } from "@/components/ui/separator";
import { Monitor, Moon, Sun } from "lucide-react";

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export default function SettingsPage() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <PageWrapper>
      <PageHeader
        title="Settings"
        description="Manage your account preferences and appearance."
      />

      <Separator />

      <div className="space-y-6">
        {/* Appearance */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Customize how Kino looks on your device.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Theme</Label>
              <p className="text-xs text-muted-foreground">
                Select your preferred color scheme.
              </p>
            </div>
            <Select
              value={mode}
              onValueChange={(val) => setMode(val as "light" | "dark" | "system")}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Future settings sections */}
        <div className="rounded-lg border p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            More settings coming soon: daily energy limit, notifications, peak energy hours, and more.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}
