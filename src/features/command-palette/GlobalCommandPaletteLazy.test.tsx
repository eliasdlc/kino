/**
 * Criterio: la paleta no entra en el chunk del shell. No se monta hasta que
 * alguien la pide, pero el atajo `mod+k` funciona desde la primera tecla y es
 * lo que la pide. Lo mismo vale para el diálogo de nueva tarea con `mod+i`.
 * Cuando el navegador queda libre, los dos chunks bajan solos, para que el
 * primer toque en Buscar o en el orbe no espere la descarga.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { useCommandPaletteStore } from "./command-palette.store";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";
import { GlobalCommandPaletteLazy } from "./GlobalCommandPaletteLazy";
import { GlobalQuickAddDialogLazy } from "@/features/tasks/GlobalQuickAddDialogLazy";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const descargados = vi.hoisted(() => ({ paleta: 0, nuevaTarea: 0 }));
vi.mock("./GlobalCommandPalette", () => {
  descargados.paleta++;
  return { GlobalCommandPalette: () => null };
});
vi.mock("@/features/tasks/GlobalQuickAddDialog", () => {
  descargados.nuevaTarea++;
  return { GlobalQuickAddDialog: () => null };
});

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

  it("los dos chunks bajan cuando el navegador queda libre, sin montar nada", async () => {
    const original = window.requestIdleCallback;
    const originalCancel = window.cancelIdleCallback;
    window.cancelIdleCallback = () => {};
    window.requestIdleCallback = ((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    }) as typeof window.requestIdleCallback;
    try {
      const { container, unmount } = renderWithProviders(
        <>
          <GlobalCommandPaletteLazy />
          <GlobalQuickAddDialogLazy />
        </>,
      );
      await waitFor(() => {
        expect(descargados.paleta).toBeGreaterThan(0);
        expect(descargados.nuevaTarea).toBeGreaterThan(0);
      });
      expect(container).toBeEmptyDOMElement();
      unmount();
    } finally {
      window.requestIdleCallback = original;
      window.cancelIdleCallback = originalCancel;
    }
  });
});
