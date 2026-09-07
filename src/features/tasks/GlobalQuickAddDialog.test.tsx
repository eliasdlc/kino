/**
 * Criterio: el diálogo de nueva tarea existe aunque la cuenta no tenga Inbox.
 * Exigía Inbox y devolvía null sin él, así que en una cuenta sin Inbox el orbe
 * de la barra, el atajo del teclado y el del icono se pintaban y no hacían
 * nada: un affordance muerto en el botón más visible del teléfono.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeSystem, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { useQuickAddStore } from "./quick-add.store";
import { GlobalQuickAddDialog } from "./GlobalQuickAddDialog";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const SEMESTRE = makeSystem({ id: mid("sys-1"), name: "Semestre actual", isInbox: false });
const BANDEJA = makeSystem({ id: mid("sys-0"), name: "Bandeja", isInbox: true });

const con = (sistemas: ReturnType<typeof makeSystem>[]) =>
  makeTestConvexClient([stubQuery(api.systems.list, sistemas)]);

beforeEach(() => useQuickAddStore.getState().setOpen(true));

describe("GlobalQuickAddDialog", () => {
  it("sin Inbox abre igual, sobre el primer sistema de la cuenta", () => {
    renderWithProviders(<GlobalQuickAddDialog />, { convex: con([SEMESTRE]) });

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toBeVisible();
    expect(within(dialogo).getByText("Sistema")).toBeVisible();
    expect(within(dialogo).getAllByRole("combobox")[0]).toHaveTextContent("Semestre actual");
  });

  it("con Inbox sigue eligiéndolo a él", () => {
    renderWithProviders(<GlobalQuickAddDialog />, { convex: con([BANDEJA, SEMESTRE]) });

    expect(within(screen.getByRole("dialog")).getAllByRole("combobox")[0]).toHaveTextContent("Bandeja");
  });

  it("sin ningún sistema no se pinta: no hay destino que ofrecer", () => {
    renderWithProviders(<GlobalQuickAddDialog />, { convex: con([]) });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
