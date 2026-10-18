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
import { useSystems } from "@/features/systems/systems.hooks";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";
import { useSearch } from "@/features/search/search.hooks";
import { SEARCH_MIN_LENGTH, SEARCH_SOURCES, type SearchResultType } from "@/features/search/search.types";
import { SearchSnippet } from "@/features/search/SearchSnippet";
import { SearchEmptyState } from "@/features/search/SearchEmptyState";
import { useCommandPaletteStore } from "./command-palette.store";
import { DESTINOS } from "@/components/navigation";
import { FileText, Hash, Layers, ListChecks, Plus, Settings, StickyNote } from "lucide-react";
import { getSystemColor } from "@/shared/utils/system-colors";

/** Un glifo por fuente: sin él la clase del resultado sólo la diría su grupo. */
const ICONO: Record<SearchResultType, typeof ListChecks> = {
  task: ListChecks,
  page: FileText,
  note: StickyNote,
  tag: Hash,
  system: Layers,
};

/**
 * La paleta: acciones, los destinos de la lista única de navegación con su
 * atajo `g` + letra, los sistemas y Ajustes; y, desde dos letras, la búsqueda.
 * El atajo `mod+k` y la carga diferida viven en `GlobalCommandPaletteLazy`.
 */
export function GlobalCommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const router = useRouter();
  const { data: systems } = useSystems();
  const setQuickAddOpen = useQuickAddStore((s) => s.setOpen);

  const [query, setQuery] = React.useState("");
  const isSearching = query.trim().length >= SEARCH_MIN_LENGTH;
  const { data: page, isFetching } = useSearch(query);
  const results = page?.items ?? [];

  const regularSystems = systems?.filter((s) => !s.isInbox) ?? [];

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
            <SearchEmptyState query={query.trim()} />
          ) : (
            <>
              {SEARCH_SOURCES.map(({ type, heading }) => {
                const filas = results.filter((r) => r.type === type);
                if (filas.length === 0) return null;
                const Icono = ICONO[type];
                return (
                  <CommandGroup key={type} heading={heading}>
                    {filas.map((r) => (
                      <CommandItem
                        key={`${type}-${r.id}`}
                        value={`${type}-${r.id}`}
                        onSelect={() => runCommand(() => router.push(r.href))}
                      >
                        <Icono className="mr-2 h-4 w-4 shrink-0 self-start text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{r.title}</span>
                          {r.snippet && <SearchSnippet snippet={r.snippet} />}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
              {page !== undefined && page.restantes > 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  Quedan {page.tope ? "más de " : ""}
                  {page.restantes} fuera de esta lista. Afina el término para verlos.
                </p>
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
              {DESTINOS.map((destino) => (
                <CommandItem key={destino.href} onSelect={() => runCommand(() => router.push(destino.href))}>
                  <destino.icon className="mr-2 h-4 w-4" />
                  <span>{destino.label}</span>
                  <CommandShortcut>G {destino.tecla.toUpperCase()}</CommandShortcut>
                </CommandItem>
              ))}
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
            <CommandGroup heading="Cuenta">
              <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Ajustes</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
