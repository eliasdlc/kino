/**
 * Criterio: la papelera enumera las cinco clases que se borran blando y las
 * enseña en una sola lista ordenada por cuándo se borró. Una carpeta con
 * subcarpetas dice cuántas vuelven con ella, y restaurar llama a la mutación
 * de su clase, no a la de las tareas.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import type { Id, TableNames } from "@convex/_generated/dataModel";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { TrashSection } from "./TrashSection";

/** Los ids de Convex son opacos y el fixture no pasa por la base. */
const id = <T extends TableNames>(value: string) => value as Id<T>;

const TAREA = {
  id: id<"tasks">("t1"), userId: id<"users">("u1"), systemId: id<"systems">("s1"), parentTaskId: null,
  title: "Comprar tinta", description: null, status: "backlog" as const, boardStatus: null, boardStatusChangedAt: null,
  energyLevel: "medium" as const, priority: "medium" as const, taskType: null, dueDate: null, startDate: null,
  estimatedTime: null, recurrenceRule: null, recurrenceParentId: null, folderId: null, contextTagId: null,
  sprintId: null, externalSource: null, externalId: null, clientRequestId: null, sortIndex: 0, metadata: null,
  inTodayPlan: false, notifiedBeforeDay: false, notifiedDueDay: false, reminderCount: 0, lastRemindedAt: null,
  completedAt: null, completedBy: null, completedVia: null, deletedAt: "2026-09-05T10:00:00.000Z",
  createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-05T10:00:00.000Z",
};

function client(overrides: { carpetas?: boolean } = {}) {
  return makeTestConvexClient([
    stubQuery(api.tasks.list, { items: [TAREA], restantes: 0 }),
    stubQuery(api.pages.trashed, [
      { id: id<"pages">("p1"), title: "La daga", systemId: id<"systems">("s1"), deletedAt: "2026-09-06T10:00:00.000Z", subpageCount: 2 },
    ]),
    stubQuery(api.entities.trashed, [
      { id: id<"entities">("e1"), systemId: id<"systems">("s1"), type: "character" as const, name: "Obsidiana", aliases: [],
        summary: null, coverImageUrl: null, createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z",
        deletedAt: "2026-09-04T10:00:00.000Z" },
    ]),
    stubQuery(api.folders.trashed, overrides.carpetas === false ? [] : [
      { id: id<"folders">("f1"), name: "Parte 1", color: "blue" as const, sortIndex: 0, parentId: null,
        systemId: id<"systems">("s1"), metadata: null, deletedAt: "2026-09-07T10:00:00.000Z", subfolderCount: 3 },
    ]),
    stubQuery(api.stickyNotes.trashed, [
      { id: id<"stickyNotes">("n1"), title: null, content: "Falta el mapa", color: "yellow" as const, sortIndex: 0,
        pageId: null, folderId: null, positionSide: null, positionY: null, positionX: null, anchorId: null,
        stackId: null, textAnchor: null, isEureka: false, deletedAt: "2026-09-03T10:00:00.000Z" },
    ]),
  ]);
}

describe("TrashSection", () => {
  it("enumera las cinco clases y las ordena por cuándo se borraron", () => {
    renderWithProviders(<TrashSection />, { convex: client() });

    const filas = screen.getAllByRole("listitem");
    expect(filas.map((li) => within(li).getByText(/Parte 1|La daga|Comprar tinta|Obsidiana|Falta el mapa/).textContent)).toEqual([
      "Parte 1",
      "La daga",
      "Comprar tinta",
      "Obsidiana",
      "Falta el mapa",
    ]);
    for (const clase of ["Carpeta", "Capítulo", "Tarea", "Entidad", "Nota adhesiva"]) {
      expect(screen.getByText(new RegExp(clase))).toBeVisible();
    }
  });

  it("una carpeta dice cuántas subcarpetas vuelven con ella", () => {
    renderWithProviders(<TrashSection />, { convex: client() });

    expect(screen.getByText(/Carpeta y 3 subcarpetas/)).toBeVisible();
    expect(screen.getByText(/Capítulo y 2 subcapítulos/)).toBeVisible();
  });

  it("restaurar llama a la mutación de la clase de esa fila", () => {
    const convex = client();
    renderWithProviders(<TrashSection />, { convex });

    const carpeta = screen.getAllByRole("listitem")[0]!;
    fireEvent.click(within(carpeta).getByRole("button", { name: "Restaurar" }));

    expect(convex.calls).toEqual([{ kind: "mutation", name: "folders:restore", args: { id: "f1" } }]);
  });

  it("sin nada borrado lo dice en vez de dejar la lista vacía", () => {
    const vacio = makeTestConvexClient([
      stubQuery(api.tasks.list, { items: [], restantes: 0 }),
      stubQuery(api.pages.trashed, []),
      stubQuery(api.entities.trashed, []),
      stubQuery(api.folders.trashed, []),
      stubQuery(api.stickyNotes.trashed, []),
    ]);
    renderWithProviders(<TrashSection />, { convex: vacio });

    expect(screen.getByText("No has borrado nada.")).toBeVisible();
    expect(screen.queryAllByRole("listitem")).toEqual([]);
  });
});
