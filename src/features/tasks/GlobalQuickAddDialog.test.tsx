/**
 * Criterio: sin ningún sistema no hay dónde crear una tarea, así que nueva
 * tarea no se pinta, y una apertura pedida por el atajo se cierra en vez de
 * quedarse esperando: si no, el diálogo saltaría solo el día que naciera el
 * primer sistema.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { useQuickAddStore } from "./quick-add.store";
import { GlobalQuickAddDialog } from "./GlobalQuickAddDialog";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

afterEach(() => useQuickAddStore.getState().setOpen(false));

describe("GlobalQuickAddDialog sin sistemas", () => {
  it("no pinta nada y cierra la apertura pedida", async () => {
    useQuickAddStore.getState().setOpen(true);
    const convex = makeTestConvexClient([stubQuery(api.systems.list, [])]);
    const { container } = renderWithProviders(<GlobalQuickAddDialog />, { convex });

    await waitFor(() => expect(useQuickAddStore.getState().open).toBe(false));
    expect(container).toBeEmptyDOMElement();
  });
});
