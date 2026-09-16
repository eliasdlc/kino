/**
 * Criterio: el título se propaga mientras se escribe. El input no guarda el
 * título en su propio estado: lo levanta en la misma tecla, que es lo que hace
 * que las migas y todo lo que lo pinta cambien sin recargar. Y su guardado no
 * comparte temporizador con el cuerpo, que se reinicia con cada tecla.
 *
 * Criterio: el editor deja de ser una foto. Cada guardado dice sobre qué
 * versión está escrito, lo que el servidor cambia por su cuenta llega a la
 * pantalla, y un guardado que choca recarga en vez de pisar lo de fuera.
 */
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import type { Editor } from "@tiptap/react";
import { api } from "@convex/_generated/api";
import {
  makeTestConvexClient,
  renderWithProviders,
  stubMutationError,
  stubQuery,
  type TestConvexClient,
} from "@/shared/testing/render";
import { EditorProvider, useSharedEditor } from "./EditorContext";
import { NotebookEditor } from "./NotebookEditor";
import type { PageDetailTransport } from "./pages.types";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const VERSION = "2026-09-16T10:00:00.000Z";
const VERSION_NUEVA = "2026-09-16T10:05:00.000Z";

const page = {
  id: "page-1",
  title: "Sin título",
  content: "<p>Límites</p>",
  systemId: "university",
  folderId: "calculo",
  updatedAt: VERSION,
} as unknown as PageDetailTransport;

/** Saca el editor compartido, que es lo que teclear cambia de verdad. */
function Sonda({ onEditor }: { onEditor: (editor: Editor) => void }) {
  const editor = useSharedEditor();
  useEffect(() => {
    if (editor) onEditor(editor);
  }, [editor, onEditor]);
  return null;
}

function renderEditor(onTitleChange: (title: string) => void, convex?: TestConvexClient) {
  let editor: Editor | null = null;
  const client =
    convex ?? makeTestConvexClient([stubQuery(api.pages.byId, page), stubQuery(api.stickyNotes.byPage, [])]);
  renderWithProviders(
    <EditorProvider initialContent={page.content ?? ""}>
      <Sonda onEditor={(e) => (editor = e)} />
      <NotebookEditor
        page={page}
        systemId="university"
        title="Sin título"
        onTitleChange={onTitleChange}
      />
    </EditorProvider>,
    { convex: client },
  );
  return { convex: client, editorDe: () => editor! };
}

/** La página tal como la dejó otra sesión: otro texto y otra versión. */
const deLaOtraPestaña = stubQuery(api.pages.byId, {
  ...page,
  title: "Derivadas",
  content: "<p>Lo de la otra pestaña</p>",
  updatedAt: VERSION_NUEVA,
});

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

  it("vaciar el título lo vacía de verdad, y el guardado dice sobre qué versión va", async () => {
    const { convex } = renderEditor(vi.fn());

    fireEvent.change(screen.getByPlaceholderText("Sin título"), { target: { value: "" } });

    await waitFor(() => expect(convex.calls).toHaveLength(1));
    // `null` borra el título; `undefined` sería no tocarlo, que es lo que antes
    // hacía imposible quitarlo desde la interfaz.
    expect(convex.calls[0]).toMatchObject({
      name: "pages:update",
      args: { id: page.id, title: null, expectedUpdatedAt: VERSION },
    });
  });
});

describe("el editor se re-sincroniza", () => {
  it("lo que guardó la otra pestaña aparece aquí sin recargar la página", async () => {
    const onTitleChange = vi.fn();
    const { convex, editorDe } = renderEditor(onTitleChange);
    await waitFor(() => expect(editorDe()).not.toBeNull());

    act(() => convex.publish(deLaOtraPestaña));

    await waitFor(() => expect(editorDe().getHTML()).toContain("Lo de la otra pestaña"));
    expect(editorDe().getHTML()).not.toContain("Límites");
    expect(onTitleChange).toHaveBeenCalledWith("Derivadas");
    // Traer texto de fuera no es teclear: no se devuelve al servidor.
    expect(convex.calls).toEqual([]);
  });

  it("un guardado que choca recarga del servidor en vez de pisarlo", async () => {
    const convex = makeTestConvexClient(
      [stubQuery(api.pages.byId, page), stubQuery(api.stickyNotes.byPage, [])],
      [stubMutationError(api.pages.update, new ConvexError({ code: "CONFLICT", message: "La página cambió" }))],
    );
    const { editorDe } = renderEditor(vi.fn(), convex);
    await waitFor(() => expect(editorDe()).not.toBeNull());

    // Esta pestaña escribe, y mientras su guardado espera en el temporizador la
    // otra guarda lo suyo.
    act(() => {
      editorDe().commands.setContent("<p>Lo que escribí yo</p>");
    });
    act(() => convex.publish(deLaOtraPestaña));
    expect(editorDe().getHTML()).toContain("Lo que escribí yo");

    // El guardado sale con la versión de antes, choca, y gana el servidor.
    await waitFor(() => expect(convex.calls).toHaveLength(1), { timeout: 3_000 });
    expect(convex.calls[0]).toMatchObject({
      name: "pages:update",
      args: { content: "<p>Lo que escribí yo</p>", expectedUpdatedAt: VERSION },
    });
    await waitFor(() => expect(editorDe().getHTML()).toContain("Lo de la otra pestaña"));
    // Y el rechazo no se reintenta en bucle: una sola escritura.
    expect(convex.calls).toHaveLength(1);
  });
});
