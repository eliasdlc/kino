/**
 * Criterio: la paleta no entra en el chunk del shell. No se monta hasta que
 * alguien la pide, pero el atajo `mod+k` funciona desde la primera tecla y es
 * lo que la pide. Lo mismo vale para el diálogo de nueva tarea con `mod+i`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { useCommandPaletteStore } from "./command-palette.store";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";
import { GlobalCommandPaletteLazy } from "./GlobalCommandPaletteLazy";
import { GlobalQuickAddDialogLazy } from "@/features/tasks/GlobalQuickAddDialogLazy";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

afterEach(() => {
  useCommandPaletteStore.getState().setOpen(false);
  useQuickAddStore.getState().setOpen(false);
});

describe("las dos hojas pesadas del shell", () => {
  it("la paleta no se monta hasta que mod+k la pide", () => {
    const { container } = renderWithProviders(<GlobalCommandPaletteLazy />);
    expect(container).toBeEmptyDOMElement();
    expect(useCommandPaletteStore.getState().open).toBe(false);

    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });

    expect(useCommandPaletteStore.getState().open).toBe(true);
  });

  it("nueva tarea no se monta hasta que mod+i la pide", () => {
    const { container } = renderWithProviders(<GlobalQuickAddDialogLazy />);
    expect(container).toBeEmptyDOMElement();

    fireEvent.keyDown(document.body, { key: "i", metaKey: true });

    expect(useQuickAddStore.getState().open).toBe(true);
  });
});
