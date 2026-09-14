/**
 * Criterio: el título se propaga mientras se escribe. El input no guarda el
 * título en su propio estado: lo levanta en la misma tecla, que es lo que hace
 * que las migas y todo lo que lo pinta cambien sin recargar. Y su guardado no
 * comparte temporizador con el cuerpo, que se reinicia con cada tecla.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { makeTestConvexClient, renderWithProviders } from "@/shared/testing/render";
import { EditorProvider } from "./EditorContext";
import { NotebookEditor } from "./NotebookEditor";
import type { PageDetailTransport } from "./pages.types";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const page = {
  id: "page-1",
  title: "Sin título",
  content: "<p>Límites</p>",
  systemId: "university",
  folderId: "calculo",
} as unknown as PageDetailTransport;

function renderEditor(onTitleChange: (title: string) => void) {
  return renderWithProviders(
    <EditorProvider initialContent={page.content ?? ""}>
      <NotebookEditor
        page={page}
        systemId="university"
        title="Sin título"
        onTitleChange={onTitleChange}
      />
    </EditorProvider>,
    { convex: makeTestConvexClient([{ name: "stickyNotes:byPage", value: [] }]) },
  );
}

describe("NotebookEditor", () => {
  it("levanta el título en la misma tecla, sin esperar al guardado", () => {
    const onTitleChange = vi.fn();
    renderEditor(onTitleChange);

    fireEvent.change(screen.getByPlaceholderText("Sin título"), { target: { value: "Derivadas" } });

    expect(onTitleChange).toHaveBeenCalledWith("Derivadas");
  });

  it("no guarda el título en su propio estado", () => {
    const onTitleChange = vi.fn();
    renderEditor(onTitleChange);

    const input = screen.getByPlaceholderText<HTMLInputElement>("Sin título");
    fireEvent.change(input, { target: { value: "Derivadas" } });

    // El valor sigue siendo el de la prop: manda el layout, no el input.
    expect(input.value).toBe("Sin título");
  });
});
