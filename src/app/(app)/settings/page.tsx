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
import { Bell, BellOff, Monitor, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/features/notifications/notifications.hooks";

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
  const { status, subscribe, unsubscribe } = usePushNotifications();

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

        {/* Notifications */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Receive alerts when Kino detects overload or low energy.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {status === 'subscribed'
                ? <Bell className="size-4 text-emerald-500" />
                : <BellOff className="size-4 text-muted-foreground" />}
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Push notifications</Label>
                <p className="text-xs text-muted-foreground">
                  {status === 'subscribed'   && 'Active — browser alerts enabled'}
                  {status === 'denied'       && 'Blocked — enable in browser settings'}
                  {status === 'unsupported'  && 'Not supported in this browser'}
                  {(status === 'idle' || status === 'loading') && 'Inactive'}
                </p>
              </div>
            </div>
            <Switch
              checked={status === 'subscribed'}
              disabled={status === 'loading' || status === 'denied' || status === 'unsupported'}
              onCheckedChange={(checked) => (checked ? subscribe() : unsubscribe())}
            />
          </div>

          {status === 'denied' && (
            <p className="text-xs text-amber-600 dark:text-amber-400 px-1">
              You blocked notifications. Go to your browser&apos;s site permissions to re-enable them for this site.
            </p>
          )}
        </div>

        {/* Future settings sections */}
        <div className="rounded-lg border p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            More settings coming soon: daily energy limit, peak energy hours, and more.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}
