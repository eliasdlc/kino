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

import { Kbd } from "@/components/ui/kbd";

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

function ShortcutRow({ label, description, keys }: { label: string; description: string; keys: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {keys}
      </div>
    </div>
  );
}

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

      <div className="space-y-8 pb-10">
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

        {/* Keyboard Shortcuts */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
            <p className="text-sm text-muted-foreground">
              Work faster with keyboard navigation.
            </p>
          </div>

          <div className="rounded-lg border px-4 flex flex-col">
            <ShortcutRow 
              label="Command Palette" 
              description="Open the quick action menu" 
              keys={<><Kbd>⌘</Kbd><Kbd>K</Kbd></>} 
            />
            <ShortcutRow 
              label="Quick Add Task" 
              description="Instantly add a task to your Inbox from anywhere" 
              keys={<><Kbd>⌘</Kbd><Kbd>I</Kbd></>} 
            />
            <ShortcutRow 
              label="Go to Inbox" 
              description="Navigate to the Inbox system" 
              keys={<><Kbd>G</Kbd><span className="text-xs text-muted-foreground mx-0.5">then</span><Kbd>I</Kbd></>} 
            />
            <ShortcutRow 
              label="Go to Systems" 
              description="Navigate to all systems overview" 
              keys={<><Kbd>G</Kbd><span className="text-xs text-muted-foreground mx-0.5">then</span><Kbd>S</Kbd></>} 
            />
            <ShortcutRow 
              label="Navigate List" 
              description="Move up and down tasks" 
              keys={<><Kbd>J</Kbd><span className="text-xs text-muted-foreground mx-0.5">/</span><Kbd>K</Kbd></>} 
            />
            <ShortcutRow 
              label="Complete Task" 
              description="Mark selected task as done" 
              keys={<><Kbd>Space</Kbd><span className="text-xs text-muted-foreground mx-0.5">or</span><Kbd>E</Kbd></>} 
            />
            <ShortcutRow 
              label="Edit Task" 
              description="Open selected task details" 
              keys={<Kbd>Enter</Kbd>} 
            />
            <ShortcutRow 
              label="Delete Task" 
              description="Open delete confirmation for selected task" 
              keys={<Kbd>Backspace</Kbd>} 
            />
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
