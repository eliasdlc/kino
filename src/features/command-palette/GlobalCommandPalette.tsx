"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useSystems } from "@/features/systems/systems.hooks";
import { Inbox, LayoutDashboard, Settings, Layers } from "lucide-react";
import { getSystemColor } from "@/shared/utils/system-colors";

export function GlobalCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { data: systems } = useSystems();

  const inboxSystem = systems?.find((s) => s.isInbox);
  const regularSystems = systems?.filter((s) => !s.isInbox) ?? [];

  useHotkey(["mod+k"], (e) => {
    e.preventDefault();
    setOpen((open) => !open);
  });

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Escribe un comando o busca..." />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Navegación">
          {inboxSystem && (
            <CommandItem onSelect={() => runCommand(() => router.push(`/systems/${inboxSystem.id}`))}>
              <Inbox className={`mr-2 h-4 w-4 text-${getSystemColor(inboxSystem.color)}`} />
              <span>{inboxSystem.name}</span>
            </CommandItem>
          )}
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/systems"))}>
            <Layers className="mr-2 h-4 w-4" />
            <span>Todos los sistemas</span>
          </CommandItem>
        </CommandGroup>
        {regularSystems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Sistemas">
              {regularSystems.map((system) => (
                <CommandItem
                  key={system.id}
                  onSelect={() => runCommand(() => router.push(`/systems/${system.id}`))}
                >
                  <span className={`mr-2 size-3 rounded-full inline-block bg-${getSystemColor(system.color)}`} />
                  <span>{system.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Ajustes">
          <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Atajos de teclado</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
