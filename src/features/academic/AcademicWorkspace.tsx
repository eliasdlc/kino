"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import { AcademicScopeContext } from "./academic-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { toast } from "sonner";

type Period = FunctionReturnType<typeof api.academicPeriods.list>[number];
type Folder = FunctionReturnType<typeof api.folders.bySystem>[number];
const role = SYSTEM_TYPE_CONFIG.academic.folderRole!;

function PeriodForm({ systemId, period, onClose }: { systemId: string; period?: Period; onClose: () => void }) {
  const [year, setYear] = useState(period?.year ?? "");
  const [name, setName] = useState(period?.name ?? "");
  const create = useConvexMutation(api.academicPeriods.create);
  const update = useConvexMutation(api.academicPeriods.update);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (period) await update.mutateAsync({ id: period._id, year, name });
      else await create.mutateAsync({ systemId, year, name });
      onClose();
    } catch { setError("No se pudo guardar. Revisa que el ciclo no exista ya en ese año."); }
  }
  return <ResponsiveDialog open onOpenChange={open => { if (!open) onClose(); }}>
    <ResponsiveDialogContent><ResponsiveDialogHeader><ResponsiveDialogTitle>{period ? "Editar ciclo" : "Nuevo ciclo"}</ResponsiveDialogTitle></ResponsiveDialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="academic-year">Año académico</Label><Input id="academic-year" value={year} onChange={e => setYear(e.target.value)} required maxLength={40} placeholder="2026–2027" /></div>
        <div className="space-y-2"><Label htmlFor="academic-cycle">Ciclo</Label><Input id="academic-cycle" value={name} onChange={e => setName(e.target.value)} required maxLength={100} placeholder="Septiembre–diciembre" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={!year.trim() || !name.trim() || create.isPending || update.isPending}>Guardar ciclo</Button>
      </form>
    </ResponsiveDialogContent>
  </ResponsiveDialog>;
}

/** Años, ciclos y materias comparten una sola selección en la URL. */
export function AcademicWorkspace({ systemId, folderId, children }: { systemId: string; folderId?: string; children: ReactNode }) {
  const { data: periods } = useConvexQuery(api.academicPeriods.list, { systemId });
  // Sin scope: el árbol siempre conserva los períodos anteriores y las materias sin asignar.
  const { data: folders } = useConvexQuery(api.folders.bySystem, { systemId });
  const { data: folder } = useConvexQuery(api.folders.detail, folderId ? { id: folderId } : "skip");
  const params = useSearchParams();
  const update = useConvexMutation(api.academicPeriods.update, { onError: () => toast.error("No se pudo actualizar el ciclo") });
  const assign = useConvexMutation(api.academicPeriods.assignSubject, { onError: () => toast.error("No se pudo asignar la materia") });
  const [editing, setEditing] = useState<Period | "new" | null>(null);
  if (!periods || !folders || (folderId && !folder)) return <Skeleton className="h-52 w-full rounded-xl" />;

  const root = folder?.breadcrumb[0] ?? folder;
  const subjectPeriod = root?.academicPeriodId ?? null;
  const requested = params.get("cycle");
  const selected = folderId ? subjectPeriod : requested === "unassigned" ? null : periods.find(p => p._id === requested)?._id ?? periods.find(p => p.isCurrent)?._id ?? null;
  const period = periods.find(p => p._id === selected);
  const years = [...new Set(periods.map(p => p.year))];
  function choose(id: string | null) {
    const url = new URL(window.location.href);
    url.searchParams.set("cycle", id ?? "unassigned");
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
  }
  function subjects(items: Folder[]) {
    return <ul className="ml-4 border-l border-border pl-4 space-y-1">
      {items.map(f => <li key={f.id}><Link className="block py-2 text-sm whitespace-normal wrap-anywhere hover:text-primary" href={`/systems/${systemId}/folders/${f.id}`}>{f.name}</Link></li>)}
      {items.length === 0 && <li className="py-2 text-sm text-muted-foreground">Sin {role.nounPlural} todavía</li>}
    </ul>;
  }
  return <AcademicScopeContext.Provider value={{ systemId, ...(folderId ? { folderId } : { academicPeriodId: selected }) }}>
    <div className="space-y-5">
      {folderId ? <div className="space-y-2">
        <p className="text-xl font-semibold whitespace-normal wrap-anywhere">{folder?.name}</p>
        <Label htmlFor="subject-cycle">Año y ciclo</Label>
        <select id="subject-cycle" className="block w-full max-w-lg rounded-xl border bg-background p-3 text-sm" value={subjectPeriod ?? ""} disabled={assign.isPending} onChange={e => assign.mutate({ folderId: root!.id, periodId: e.target.value || null })}>
          <option value="">Sin ciclo</option>
          {periods.map(p => <option key={p._id} value={p._id}>{p.year} · {p.name}{p.isClosed ? " · Cerrado" : ""}</option>)}
        </select>
      </div> : <div className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Años y ciclos</h2><Button variant="outline" size="sm" onClick={() => setEditing("new")}>Nuevo ciclo</Button></div>
        {years.map(year => <details key={year} open={year === period?.year || years.length === 1} className="border-b border-border pb-2">
          <summary className="cursor-pointer py-2 font-semibold">{year}</summary>
          <div className="ml-3 space-y-2 border-l border-border pl-3">
            {periods.filter(p => p.year === year).map(p => <details key={p._id} open={selected === p._id}>
              <summary className="cursor-pointer py-2 text-sm"><span className={selected === p._id ? "text-primary" : ""}>{p.name}</span>{p.isCurrent && <span className="ml-2 text-xs text-primary">Actual</span>}{p.isClosed && <span className="ml-2 text-xs text-muted-foreground">Cerrado</span>}</summary>
              <div className="flex flex-wrap items-center gap-2 py-2">
                <Button variant={selected === p._id ? "default" : "outline"} size="sm" onClick={() => choose(p._id)}>Ver ciclo</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>Editar ciclo</Button>
                {!p.isCurrent && !p.isClosed && <Button variant="ghost" size="sm" disabled={update.isPending} onClick={() => update.mutate({ id: p._id, isCurrent: true })}>Marcar actual</Button>}
                <Button variant="ghost" size="sm" disabled={update.isPending} onClick={() => { choose(p._id); update.mutate({ id: p._id, isClosed: !p.isClosed }); }}>{p.isClosed ? "Reabrir ciclo" : "Cerrar ciclo"}</Button>
              </div>
              {subjects(folders.filter(f => f.academicPeriodId === p._id))}
            </details>)}
          </div>
        </details>)}
        <details open={selected === null}>
          <summary className="cursor-pointer py-2 text-sm">Sin ciclo · {folders.filter(f => !f.academicPeriodId).length} {role.nounPlural}</summary>
          <Button variant={selected === null ? "default" : "outline"} size="sm" onClick={() => choose(null)}>Ver sin ciclo</Button>
          {subjects(folders.filter(f => !f.academicPeriodId))}
        </details>
        <p className="text-sm font-medium" aria-live="polite">{period ? `${period.year} · ${period.name}` : "Sin ciclo"}</p>
      </div>}
      {children}
      {editing && <PeriodForm systemId={systemId} period={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  </AcademicScopeContext.Provider>;
}
