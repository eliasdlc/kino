"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TasksList } from "@/features/tasks/TasksList";
import { useUpdateSystem } from "../systems.hooks";
import { SYSTEM_TYPE_CONFIG, type SystemTabId } from "@/shared/lib/system-types";
import type { SystemViewProps } from "./SystemDetailView";

const ALL_TABS = SYSTEM_TYPE_CONFIG.custom.tabs;

const TAB_LABELS: Record<SystemTabId, string> = {
  backlog: "Backlog",
  planning: "Planning",
  action: "Action",
  archive: "Archive",
};

export function SystemCustomView({ system, initialTasks }: SystemViewProps) {
  const { mutate: updateSystem } = useUpdateSystem();

  const savedTabs = system.metadata?.tabs?.length ? system.metadata.tabs : ALL_TABS;
  const savedDefault =
    system.metadata?.defaultTab && savedTabs.includes(system.metadata.defaultTab)
      ? system.metadata.defaultTab
      : savedTabs[0];

  // Estado local para feedback inmediato — `system` llega como prop del server
  // component y no se re-renderiza sin navegar.
  const [tabs, setTabs] = useState<SystemTabId[]>(savedTabs);
  const [defaultTab, setDefaultTab] = useState<SystemTabId>(savedDefault);

  function persist(nextTabs: SystemTabId[], nextDefault: SystemTabId) {
    setTabs(nextTabs);
    setDefaultTab(nextDefault);
    updateSystem({
      systemId: system.id,
      data: { metadata: { tabs: nextTabs, defaultTab: nextDefault } },
    });
  }

  function toggleTab(tab: SystemTabId) {
    const isOn = tabs.includes(tab);
    // Nunca dejar el sistema sin tabs
    if (isOn && tabs.length === 1) return;
    const nextTabs = isOn
      ? ALL_TABS.filter((t) => t !== tab && tabs.includes(t))
      : ALL_TABS.filter((t) => t === tab || tabs.includes(t));
    const nextDefault = nextTabs.includes(defaultTab) ? defaultTab : nextTabs[0];
    persist(nextTabs, nextDefault);
  }

  function changeDefault(tab: SystemTabId) {
    persist(tabs, tab);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="size-4" />
              Configurar tabs
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Tabs visibles</DropdownMenuLabel>
            {ALL_TABS.map((tab) => (
              <DropdownMenuCheckboxItem
                key={tab}
                checked={tabs.includes(tab)}
                onCheckedChange={() => toggleTab(tab)}
                onSelect={(e) => e.preventDefault()}
                disabled={tabs.includes(tab) && tabs.length === 1}
              >
                {TAB_LABELS[tab]}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Tab por defecto</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={defaultTab} onValueChange={(v) => changeDefault(v as SystemTabId)}>
              {tabs.map((tab) => (
                <DropdownMenuRadioItem key={tab} value={tab} onSelect={(e) => e.preventDefault()}>
                  {TAB_LABELS[tab]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TasksList
        key={tabs.join(",") + defaultTab}
        systemId={system.id}
        initialData={initialTasks}
        visibleTabs={tabs}
        defaultTab={defaultTab}
      />
    </div>
  );
}
