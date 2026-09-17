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
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { api } from "@convex/_generated/api";
import {
  makeTestConvexClient,
  renderWithProviders,
  stubMutation,
  stubMutationError,
  stubMutationPending,
  stubQuery,
  type TestConvexClient,
} from "@/shared/testing/render";
import { EditorProvider, useSharedEditor } from "./EditorContext";
import { NotebookEditor } from "./NotebookEditor";
import type { PageDetailTransport, PageMutationResult } from "./pages.types";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

// El aviso de «no se guardó» es el único rastro de un editor que se cree
// desmontado, así que aquí se mira, no se pinta.
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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

/**
 * El anfitrión que hace de layout: el título vive fuera del editor y vuelve
 * como prop, que es lo que hace que el guardado de cierre mande lo tecleado.
 */
function renderComoElLayout(convex: TestConvexClient, { strict = false } = {}) {
  let editor: Editor | null = null;
  function Anfitrion() {
    const [titulo, setTitulo] = useState(page.title ?? "");
    return (
      <EditorProvider initialContent={page.content ?? ""}>
        <Sonda onEditor={(e) => (editor = e)} />
        <NotebookEditor page={page} systemId="university" title={titulo} onTitleChange={setTitulo} />
      </EditorProvider>
    );
  }
  // `reactStrictMode` está activo en `next.config.ts`, así que en desarrollo
  // cada efecto se monta, se desmonta y se vuelve a montar. Va como opción de
  // `render` y no como elemento `<StrictMode>`: envuelto a mano dentro del
  // árbol de proveedores, React no dobla nada y el test no probaría nada.
  const { unmount } = renderWithProviders(<Anfitrion />, { convex, reactStrictMode: strict });
  return { convex, editorDe: () => editor!, unmount };
}

/** Lo que devuelve un guardado: al editor sólo le importa la versión nueva. */
const respuestaConVersion = (updatedAt: string) => ({ ...page, updatedAt }) as unknown as PageMutationResult;

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

/**
 * El editor también choca consigo mismo. El cuerpo y el título tienen
 * temporizadores distintos, y el cierre del capítulo manda lo que quede: tres
 * caminos que salían con la misma versión, así que el primero la movía y el
 * segundo se estrellaba contra el propio editor. Nadie más había escrito.
 */
describe("dos guardados propios no se pisan entre sí", () => {
  it("el cuerpo y el título pendientes salen en un solo guardado al cerrar el capítulo", async () => {
    const convex = makeTestConvexClient(
      [stubQuery(api.pages.byId, page), stubQuery(api.stickyNotes.byPage, [])],
      [stubMutation(api.pages.update, respuestaConVersion(VERSION_NUEVA))],
    );
    const { editorDe, unmount } = renderComoElLayout(convex);
    await waitFor(() => expect(editorDe()).not.toBeNull());

    act(() => {
      editorDe().commands.setContent("<p>Lo que escribí yo</p>");
    });
    fireEvent.change(screen.getByPlaceholderText("Sin título"), { target: { value: "Derivadas" } });
    // Se sale del capítulo antes de que venza ningún temporizador.
    act(() => unmount());

    // Dos escrituras con la misma versión chocarían entre sí, y la segunda (el
    // título, que es el que va detrás) se perdía sin que nadie lo viera.
    expect(convex.calls).toHaveLength(1);
    expect(convex.calls[0]).toMatchObject({
      name: "pages:update",
      args: {
        id: page.id,
        content: "<p>Lo que escribí yo</p>",
        title: "Derivadas",
        expectedUpdatedAt: VERSION,
      },
    });
  });

  it("un guardado que vence con otro en vuelo espera turno y hereda su versión", async () => {
    const { stub, responder } = stubMutationPending(api.pages.update);
    const convex = makeTestConvexClient(
      [stubQuery(api.pages.byId, page), stubQuery(api.stickyNotes.byPage, [])],
      [stub],
    );
    const { editorDe } = renderComoElLayout(convex);
    await waitFor(() => expect(editorDe()).not.toBeNull());

    // El título vence a los 400 ms y se queda esperando respuesta.
    fireEvent.change(screen.getByPlaceholderText("Sin título"), { target: { value: "Derivadas" } });
    await waitFor(() => expect(convex.calls).toHaveLength(1), { timeout: 2_000 });
    expect(convex.calls[0]).toMatchObject({ args: { title: "Derivadas", expectedUpdatedAt: VERSION } });

    // Mientras el primero espera, se teclea el cuerpo. Su temporizador es de
    // 1500 ms: vence dentro de la ventana, y aun así no sale.
    act(() => {
      editorDe().commands.setContent("<p>Lo que escribí yo</p>");
    });
    await new Promise((resolve) => setTimeout(resolve, 1_800));
    expect(convex.calls).toHaveLength(1);

    // Y cuando el primero contesta, el segundo sale con la versión que devolvió,
    // no con la que el editor tenía cuando se tecleó.
    await act(async () => responder(respuestaConVersion(VERSION_NUEVA)));

    await waitFor(() => expect(convex.calls).toHaveLength(2));
    expect(convex.calls[1]).toMatchObject({
      args: { content: "<p>Lo que escribí yo</p>", expectedUpdatedAt: VERSION_NUEVA },
    });
  });
});

describe("el editor vivo sabe que está vivo", () => {
  it("bajo StrictMode, un choque recarga y no avisa de que se perdió el texto", async () => {
    const convex = makeTestConvexClient(
      [stubQuery(api.pages.byId, page), stubQuery(api.stickyNotes.byPage, [])],
      [stubMutationError(api.pages.update, new ConvexError({ code: "CONFLICT", message: "La página cambió" }))],
    );
    // El espía es del módulo y vive lo que vive el fichero: lo que cuenta es
    // lo que toastee este test, no lo que toastee el que venga antes.
    vi.mocked(toast.error).mockClear();
    const { editorDe } = renderComoElLayout(convex, { strict: true });
    await waitFor(() => expect(editorDe()).not.toBeNull());

    act(() => {
      editorDe().commands.setContent("<p>Lo que escribí yo</p>");
    });
    act(() => convex.publish(deLaOtraPestaña));

    await waitFor(() => expect(convex.calls).toHaveLength(1), { timeout: 3_000 });
    await waitFor(() => expect(editorDe().getHTML()).toContain("Lo de la otra pestaña"));
    // StrictMode monta, desmonta y vuelve a montar. Un editor que sólo sabe
    // darse por muerto se pasa la sesión entera avisando de que no guarda,
    // teniendo la pantalla delante para recargar.
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("una versión de fuera que sólo cambia el título", () => {
  it("no reemplaza el cuerpo, así que el cursor no se mueve", async () => {
    const convex = makeTestConvexClient([stubQuery(api.pages.byId, page), stubQuery(api.stickyNotes.byPage, [])]);
    const { editorDe } = renderComoElLayout(convex);
    await waitFor(() => expect(editorDe()).not.toBeNull());
    act(() => {
      editorDe().commands.setTextSelection(4);
    });
    const cursor = editorDe().state.selection.from;

    // Renombrar el cuaderno desde otra pestaña: mismo cuerpo, otro título.
    act(() =>
      convex.publish(stubQuery(api.pages.byId, { ...page, title: "Derivadas", updatedAt: VERSION_NUEVA })),
    );

    await waitFor(() => expect(screen.getByPlaceholderText<HTMLInputElement>("Sin título").value).toBe("Derivadas"));
    // `setContent` reemplaza el documento entero y deja el cursor al final del
    // texto, sin que el texto haya cambiado. La aserción es de igualdad con
    // dónde estaba porque lo que sobra es el salto, no el sitio al que salta.
    expect(editorDe().state.selection.from).toBe(cursor);
    expect(editorDe().getHTML()).toBe(page.content);
  });
});
