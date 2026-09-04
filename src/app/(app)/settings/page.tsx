"use client";

import { Suspense } from "react";
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
import { Bell, BellOff, Download, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/features/notifications/notifications.hooks";
import { ApiKeysSection } from "@/features/api-keys/ApiKeysSection";
import { GithubConnectionSection } from "@/features/github-sync/GithubConnectionSection";
import { EnergyLimitSection } from "@/features/settings/EnergyLimitSection";
import { TimezoneSection } from "@/features/settings/TimezoneSection";
import { WeeklyReviewDaySection } from "@/features/settings/WeeklyReviewDaySection";
import { ReclaimSpaceSection } from "@/features/uploads/ReclaimSpaceSection";
import { AccountSection } from "@/features/account/AccountSection";
import { DangerZoneSection } from "@/features/account/DangerZoneSection";
import {
  useUserSettings,
  useUpdateUserSettings,
  useExportWorkspace,
} from "@/features/settings/settings.hooks";

import { Kbd } from "@/components/ui/kbd";

const THEME_OPTIONS = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
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
  const { data: settings } = useUserSettings();
  const { mutate: updateSettings } = useUpdateUserSettings();
  const exportWorkspace = useExportWorkspace();

  // Cambiar el tema aplica al instante (store + localStorage) y lo persiste en
  // la cuenta para que viaje entre dispositivos.
  function handleThemeChange(next: "light" | "dark" | "system") {
    setMode(next);
    updateSettings({ theme: next });
  }

  const notificationsEnabled = settings?.notificationsEnabled ?? true;

  return (
    <PageWrapper>
      <PageHeader
        title="Ajustes"
        description="Administra las preferencias de tu cuenta y la apariencia."
      />

      <Separator />

      <div className="space-y-8 pb-10">
        {/* Cuenta: nombre, correo, contraseña y sesiones, en el panel de Clerk. */}
        <AccountSection />

        {/* Appearance */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Apariencia</h2>
            <p className="text-sm text-muted-foreground">
              Personaliza cómo se ve Kino en tu dispositivo.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Tema</Label>
              <p className="text-xs text-muted-foreground">
                Elige tu esquema de color preferido.
              </p>
            </div>
            <Select
              value={mode}
              onValueChange={(val) => handleThemeChange(val as "light" | "dark" | "system")}
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

        {/* Keyboard Shortcuts — sin sentido en touch */}
        <div className="hidden md:block space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Atajos de teclado</h2>
            <p className="text-sm text-muted-foreground">
              Trabaja más rápido con el teclado.
            </p>
          </div>

          <div className="rounded-lg border px-4 flex flex-col">
            <ShortcutRow 
              label="Paleta de comandos" 
              description="Abre el menú de acciones rápidas" 
              keys={<><Kbd>⌘</Kbd><Kbd>K</Kbd></>} 
            />
            <ShortcutRow 
              label="Agregar tarea rápida" 
              description="Agrega una tarea a tu Inbox al instante desde cualquier lugar" 
              keys={<><Kbd>⌘</Kbd><Kbd>I</Kbd></>} 
            />
            <ShortcutRow 
              label="Ir a Inbox" 
              description="Navega al sistema Inbox" 
              keys={<><Kbd>G</Kbd><span className="text-xs text-muted-foreground mx-0.5">luego</span><Kbd>I</Kbd></>} 
            />
            <ShortcutRow
              label="Ir a Sistemas"
              description="Navega a la vista de todos los sistemas"
              keys={<><Kbd>G</Kbd><span className="text-xs text-muted-foreground mx-0.5">luego</span><Kbd>S</Kbd></>}
            />
            <ShortcutRow
              label="Ir a Tareas"
              description="Navega a la vista global de tareas"
              keys={<><Kbd>G</Kbd><span className="text-xs text-muted-foreground mx-0.5">luego</span><Kbd>T</Kbd></>}
            />
            <ShortcutRow
              label="Ir a Dashboard"
              description="Navega al dashboard"
              keys={<><Kbd>G</Kbd><span className="text-xs text-muted-foreground mx-0.5">luego</span><Kbd>D</Kbd></>}
            />
            <ShortcutRow 
              label="Navegar lista" 
              description="Sube y baja entre tareas" 
              keys={<><Kbd>J</Kbd><span className="text-xs text-muted-foreground mx-0.5">/</span><Kbd>K</Kbd></>} 
            />
            <ShortcutRow 
              label="Completar tarea" 
              description="Marca la tarea seleccionada como completada" 
              keys={<><Kbd>Space</Kbd><span className="text-xs text-muted-foreground mx-0.5">o</span><Kbd>E</Kbd></>} 
            />
            <ShortcutRow 
              label="Editar tarea" 
              description="Abre el detalle de la tarea seleccionada" 
              keys={<Kbd>Enter</Kbd>} 
            />
            <ShortcutRow 
              label="Eliminar tarea" 
              description="Abre la confirmación de borrado de la tarea seleccionada" 
              keys={<Kbd>Backspace</Kbd>} 
            />
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Notificaciones</h2>
            <p className="text-sm text-muted-foreground">
              Recordatorios de tareas y alertas de energía directamente en tu dispositivo.
            </p>
          </div>

          {/* Interruptor maestro: cuando está apagado, ningún cron envía
              recordatorios a esta cuenta, en cualquier dispositivo. */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Recibir recordatorios</Label>
              <p className="text-xs text-muted-foreground">
                Controla si Kino te envía recordatorios de tareas y alertas de energía.
              </p>
            </div>
            <Switch
              checked={notificationsEnabled}
              disabled={!settings}
              onCheckedChange={(checked) => updateSettings({ notificationsEnabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {status === 'subscribed'
                ? <Bell className="size-4 text-emerald-500" />
                : <BellOff className="size-4 text-muted-foreground" />}
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Notificaciones push en este dispositivo</Label>
                <p className="text-xs text-muted-foreground">
                  {status === 'subscribed'   && 'Activas — recibirás alertas en este dispositivo'}
                  {status === 'denied'       && 'Bloqueadas — actívalas en los permisos del navegador'}
                  {status === 'unsupported'  && 'No soportado en este navegador'}
                  {(status === 'idle' || status === 'loading') && 'Inactivas'}
                </p>
              </div>
            </div>
            <Switch
              checked={status === 'subscribed'}
              disabled={status === 'loading' || status === 'denied' || status === 'unsupported'}
              onCheckedChange={(checked) => (checked ? subscribe() : unsubscribe())}
            />
          </div>

          {status === 'subscribed' && (
            <ul className="text-xs text-muted-foreground space-y-1 px-1 list-disc list-inside">
              <li>Recordatorio el día antes de que venza una tarea</li>
              <li>Recordatorio el día que vence la tarea</li>
              <li>Alertas de sobrecarga y energía baja</li>
            </ul>
          )}

          {status === 'denied' && (
            <p className="text-xs text-amber-600 dark:text-amber-400 px-1">
              Bloqueaste las notificaciones. Ve a los permisos del sitio en tu navegador para reactivarlas.
            </p>
          )}
        </div>

        {/* Zona horaria */}
        <TimezoneSection />

        {/* Energía */}
        <EnergyLimitSection />

        {/* Revisión semanal */}
        <WeeklyReviewDaySection />

        {/* API Keys */}
        <ApiKeysSection />

        {/* GitHub — lee el resultado del callback de OAuth de la URL, así que
            necesita su propio límite de Suspense. */}
        <Suspense>
          <GithubConnectionSection />
        </Suspense>

        {/* Datos y portabilidad */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Datos y portabilidad</h2>
            <p className="text-sm text-muted-foreground">
              Exporta todo tu workspace para tener una copia local o migrar a otra herramienta.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Exportar workspace completo</p>
              <p className="text-xs text-muted-foreground">
                Descarga un ZIP con todos tus sistemas, tareas, carpetas y cuadernos en Markdown y
                JSON, con las imágenes incluidas.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              disabled={exportWorkspace.isPending}
              onClick={() => exportWorkspace.mutate()}
            >
              {exportWorkspace.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Preparando el ZIP
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Exportar ZIP
                </>
              )}
            </Button>
          </div>

          <ReclaimSpaceSection />
        </div>

        {/* Va al final, después de la exportación: es el orden natural de irse. */}
        <DangerZoneSection />
      </div>
    </PageWrapper>
  );
}
