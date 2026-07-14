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
  CommandShortcut,
} from "@/components/ui/command";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useSystems } from "@/features/systems/systems.hooks";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";
import { useSearch } from "@/features/search/search.hooks";
import { SEARCH_MIN_LENGTH } from "@/features/search/search.types";
import { useCommandPaletteStore } from "./command-palette.store";
import {
  Calendar,
  FileText,
  Inbox,
  LayoutDashboard,
  List,
  ListChecks,
  Plus,
  Settings,
  Layers,
} from "lucide-react";
import { getSystemColor } from "@/shared/utils/system-colors";

export function GlobalCommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const router = useRouter();
  const { data: systems } = useSystems();
  const setQuickAddOpen = useQuickAddStore((s) => s.setOpen);

  const [query, setQuery] = React.useState("");
  const isSearching = query.trim().length >= SEARCH_MIN_LENGTH;
  const { data: results = [], isFetching } = useSearch(query);

  const inboxSystem = systems?.find((s) => s.isInbox);
  const regularSystems = systems?.filter((s) => !s.isInbox) ?? [];

  const taskResults = results.filter((r) => r.type === "task");
  const pageResults = results.filter((r) => r.type === "page");
  const systemResults = results.filter((r) => r.type === "system");

  useHotkey(["mod+k"], (e) => {
    e.preventDefault();
    toggle();
  });

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) setQuery("");
    },
    [setOpen],
  );

  const runCommand = React.useCallback(
    (command: () => void) => {
      handleOpenChange(false);
      command();
    },
    [handleOpenChange],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      shouldFilter={!isSearching}
    >
      <CommandInput
        placeholder="Escribe un comando o busca..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isSearching ? (
          isFetching && results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Sin resultados.
            </div>
          ) : (
            <>
              {taskResults.length > 0 && (
                <CommandGroup heading="Tareas">
                  {taskResults.map((r) => (
                    <CommandItem
                      key={`task-${r.id}`}
                      value={`task-${r.id}`}
                      onSelect={() =>
                        runCommand(() => router.push(`/systems/${r.systemId}`))
                      }
                    >
                      <ListChecks className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{r.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {pageResults.length > 0 && (
                <CommandGroup heading="Páginas">
                  {pageResults.map((r) => (
                    <CommandItem
                      key={`page-${r.id}`}
                      value={`page-${r.id}`}
                      disabled={!r.systemId}
                      onSelect={() =>
                        r.systemId &&
                        runCommand(() =>
                          router.push(`/systems/${r.systemId}/pages/${r.id}`),
                        )
                      }
                    >
                      <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{r.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {systemResults.length > 0 && (
                <CommandGroup heading="Sistemas">
                  {systemResults.map((r) => (
                    <CommandItem
                      key={`system-${r.id}`}
                      value={`system-${r.id}`}
                      onSelect={() =>
                        runCommand(() => router.push(`/systems/${r.id}`))
                      }
                    >
                      <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{r.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )
        ) : (
          <>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup heading="Acciones">
              <CommandItem onSelect={() => runCommand(() => setQuickAddOpen(true))}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Nueva tarea</span>
                <CommandShortcut>⌘I</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Navegación">
              {inboxSystem && (
                <CommandItem onSelect={() => runCommand(() => router.push(`/systems/${inboxSystem.id}`))}>
                  <Inbox className={`mr-2 h-4 w-4 text-${getSystemColor(inboxSystem.color)}`} />
                  <span>{inboxSystem.name}</span>
                  <CommandShortcut>G I</CommandShortcut>
                </CommandItem>
              )}
              <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
                <CommandShortcut>G D</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/systems"))}>
                <Layers className="mr-2 h-4 w-4" />
                <span>Todos los sistemas</span>
                <CommandShortcut>G S</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/tasks"))}>
                <List className="mr-2 h-4 w-4" />
                <span>Tareas</span>
                <CommandShortcut>G T</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/calendar"))}>
                <Calendar className="mr-2 h-4 w-4" />
                <span>Calendario</span>
                <CommandShortcut>G C</CommandShortcut>
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
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
