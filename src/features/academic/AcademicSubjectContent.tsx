"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SystemAcademicView } from "@/features/systems/views/SystemAcademicView";
import type { SystemViewProps } from "@/features/systems/views/SystemDetailView";

/** La materia comparte las dos superficies del sistema, con sus propios datos. */
export function AcademicSubjectContent({ system, initialTasks, documents }: SystemViewProps & { documents: ReactNode }) {
  const params = useSearchParams();
  const tab = params.get("tab") === "docs" ? "docs" : "tasks";
  function setTab(value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
  }
  return <Tabs value={tab} onValueChange={setTab} className="space-y-4">
    <TabsList><TabsTrigger value="tasks">Tareas</TabsTrigger><TabsTrigger value="docs">Apuntes</TabsTrigger></TabsList>
    <TabsContent value="tasks"><SystemAcademicView system={system} initialTasks={initialTasks} /></TabsContent>
    <TabsContent value="docs">{documents}</TabsContent>
  </Tabs>;
}
