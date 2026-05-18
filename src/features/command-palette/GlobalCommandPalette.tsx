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
import { Inbox, LayoutDashboard, Settings, Layers, Focus } from "lucide-react";

export function GlobalCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  // Command Palette global toggle
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
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/inbox"))}>
            <Inbox className="mr-2 h-4 w-4" />
            <span>Inbox</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/systems"))}>
            <Layers className="mr-2 h-4 w-4" />
            <span>Systems</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/focus"))}>
            <Focus className="mr-2 h-4 w-4" />
            <span>Focus Mode</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => router.push("/settings/shortcuts"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Keyboard Shortcuts</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
