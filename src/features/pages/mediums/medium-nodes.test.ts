import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { SceneBreak } from "./scene-break.extension";
import { MangaPage, Panel } from "./manga.extension";
import { SCREENPLAY_NODES, ScreenplayKeys } from "./screenplay.extension";

/**
 * Los nodos de medium se prueban contra un editor real: su valor está en la
 * mecánica de ProseMirror (encadenar paneles, ciclar tipos de línea, salir de un
 * bloque sin quedar encerrado), y eso no se puede afirmar leyendo el schema.
 */
function makeEditor(content: string, screenplay = false) {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      SceneBreak,
      MangaPage,
      Panel,
      ...SCREENPLAY_NODES,
      ...(screenplay ? [ScreenplayKeys] : []),
    ],
    content,
  });
}

/** Ejecuta el keymap del editor como lo haría el navegador. */
function press(editor: Editor, key: string, shiftKey = false): boolean {
  const event = new KeyboardEvent("keydown", { key, shiftKey, bubbles: true });
  return (
    editor.view.someProp("handleKeyDown", (fn) => fn(editor.view, event)) ?? false
  );
}

/** Teclea un carácter al final del documento y dispara los input rules. */
function type_(editor: Editor, text: string): void {
  const at = editor.state.doc.content.size - 1;
  editor.commands.setTextSelection(at);
  editor.view.someProp("handleTextInput", (fn) =>
    fn(editor.view, at, at, text, () => editor.state.tr),
  );
}

/** Posición de texto dentro del último párrafo vacío del documento. */
function lastEmptyParagraph(editor: Editor): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" && node.content.size === 0) found = pos + 1;
  });
  return found;
}

function nodeNames(editor: Editor): string[] {
  const names: string[] = [];
  editor.state.doc.forEach((node) => names.push(node.type.name));
  return names;
}

describe("SceneBreak", () => {
  it("se inserta y deja un párrafo detrás donde seguir escribiendo", () => {
    const editor = makeEditor("<p>Kael cruzó el puente.</p>");
    editor.commands.focus("end");
    editor.commands.setSceneBreak();

    expect(nodeNames(editor)).toEqual(["paragraph", "sceneBreak", "paragraph"]);
    expect(editor.getHTML()).toContain("data-scene-break");
    editor.destroy();
  });

  it('el input rule "* * * " lo crea al escribir, y `*** ` sigue siendo un <hr>', () => {
    const editor = makeEditor("<p>* * *</p>");
    type_(editor, " ");
    expect(nodeNames(editor)).toContain("sceneBreak");
    editor.destroy();

    const hr = makeEditor("<p>***</p>");
    type_(hr, " ");
    expect(nodeNames(hr)).toContain("horizontalRule");
    expect(nodeNames(hr)).not.toContain("sceneBreak");
    hr.destroy();
  });

  it("sobrevive al viaje por HTML (así se guarda el contenido)", () => {
    const editor = makeEditor("<p>a</p>");
    editor.commands.focus("end");
    editor.commands.setSceneBreak();
    const html = editor.getHTML();

    const reloaded = makeEditor(html);
    expect(nodeNames(reloaded)).toContain("sceneBreak");
    editor.destroy();
    reloaded.destroy();
  });
});

describe("Panel: Enter encadena el guion", () => {
  it("Enter en el párrafo vacío final abre el siguiente panel", () => {
    const editor = makeEditor(
      "<section data-manga-page><article data-panel><p>Kael entra.</p><p></p></article></section>",
    );
    editor.commands.setTextSelection(lastEmptyParagraph(editor));

    expect(press(editor, "Enter")).toBe(true);

    const page = editor.state.doc.firstChild!;
    expect(page.type.name).toBe("mangaPage");
    expect(page.childCount).toBe(2);
    // El párrafo vacío se consume: no queda basura en el panel anterior.
    expect(page.child(0).childCount).toBe(1);
    // Y el cursor aterriza dentro del panel nuevo.
    expect(editor.state.selection.$from.node(2).type.name).toBe("panel");
    editor.destroy();
  });

  it("en medio del panel, Enter parte la línea sin expulsarte de la página", () => {
    const editor = makeEditor(
      "<section data-manga-page><article data-panel><p></p><p>SFX: CRASH</p></article></section>",
    );
    editor.commands.setTextSelection(lastEmptyParagraph(editor));

    expect(press(editor, "Enter")).toBe(true);
    // Sin este caso cubierto, el `liftEmptyBlock` del keymap base sacaría el
    // párrafo vacío fuera de la página entera.
    expect(nodeNames(editor)[0]).toBe("mangaPage");
    expect(editor.state.doc.firstChild!.child(0).childCount).toBe(3);
    expect(editor.state.selection.$from.node(2).type.name).toBe("panel");
    editor.destroy();
  });

  it("un segundo Enter en un panel vacío sale del guion en vez de encerrarte", () => {
    const editor = makeEditor(
      "<section data-manga-page><article data-panel><p></p></article></section>",
    );
    editor.commands.setTextSelection(lastEmptyParagraph(editor));

    expect(press(editor, "Enter")).toBe(true);
    // La página se va con su único panel: no queda un contenedor huérfano.
    expect(nodeNames(editor).every((n) => n === "paragraph")).toBe(true);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    editor.destroy();
  });

  it("el panel vacío de una página con más paneles sale detrás de la página", () => {
    const editor = makeEditor(
      "<section data-manga-page>" +
        "<article data-panel><p>Kael entra.</p></article>" +
        "<article data-panel><p></p></article>" +
        "</section>",
    );
    editor.commands.setTextSelection(lastEmptyParagraph(editor));

    expect(press(editor, "Enter")).toBe(true);
    // La página conserva su panel con contenido y el cursor cae fuera, en prosa:
    // una página solo admite paneles, así que el párrafo no cabe dentro.
    expect(nodeNames(editor)[0]).toBe("mangaPage");
    expect(editor.state.doc.firstChild!.childCount).toBe(1);
    expect(editor.state.selection.$from.node(1).type.name).toBe("paragraph");
    editor.destroy();
  });

  it("el panel suelto del webtoon funciona sin página que lo contenga", () => {
    const editor = makeEditor("<article data-panel><p>Beat.</p><p></p></article>");
    editor.commands.setTextSelection(lastEmptyParagraph(editor));

    expect(press(editor, "Enter")).toBe(true);
    expect(nodeNames(editor).filter((n) => n === "panel")).toHaveLength(2);
    expect(editor.state.selection.$from.node(1).type.name).toBe("panel");
    editor.destroy();
  });

  it("insertar un panel desde dentro de otro lo pone al lado, no anidado", () => {
    const editor = makeEditor(
      "<section data-manga-page><article data-panel><p>Kael entra.</p></article></section>",
    );
    editor.commands.setTextSelection(4);
    editor.commands.insertPanel();

    const page = editor.state.doc.firstChild!;
    expect(page.childCount).toBe(2);
    expect(page.child(1).type.name).toBe("panel");
    // Un panel dentro de otro es legal para el schema pero absurdo para el guion.
    expect(page.child(0).child(0).type.name).toBe("paragraph");
    editor.destroy();
  });

  it("insertar una página desde dentro del guion la pone detrás de la actual", () => {
    const editor = makeEditor(
      "<section data-manga-page><article data-panel><p>Kael entra.</p></article></section>",
    );
    editor.commands.setTextSelection(4);
    editor.commands.insertMangaPage();

    expect(nodeNames(editor).filter((n) => n === "mangaPage")).toHaveLength(2);
    expect(editor.state.doc.firstChild!.childCount).toBe(1);
    expect(editor.state.selection.$from.node(2).type.name).toBe("panel");
    editor.destroy();
  });

  it("en prosa, insertar página o panel funciona en el cursor", () => {
    const editor = makeEditor("<p>Kael entra.</p>");
    editor.commands.focus("end");
    editor.commands.insertMangaPage();
    expect(nodeNames(editor)).toContain("mangaPage");
    editor.destroy();
  });

  it("un bloque de guion al final del documento siempre deja prosa detrás", () => {
    // Red de seguridad del TrailingNode de StarterKit: sin un párrafo final, un
    // manuscrito que termina en página quedaría sin sitio donde poner el cursor.
    const editor = makeEditor("<section data-manga-page><article data-panel><p>a</p></article></section>");
    editor.commands.setTextSelection(2);

    expect(nodeNames(editor)).toEqual(["mangaPage", "paragraph"]);
    editor.destroy();
  });
});

describe("Screenplay: Tab cicla y Enter encadena", () => {
  function currentType(editor: Editor): string {
    return editor.state.selection.$from.parent.type.name;
  }

  it("Tab recorre el anillo de tipos y Shift-Tab lo desanda", () => {
    const editor = makeEditor('<p data-sp="sceneHeading">INT. CASA - DÍA</p>', true);
    editor.commands.focus("end");

    expect(press(editor, "Tab")).toBe(true);
    expect(currentType(editor)).toBe("action");
    press(editor, "Tab");
    expect(currentType(editor)).toBe("character");
    press(editor, "Tab", true);
    expect(currentType(editor)).toBe("action");
    editor.destroy();
  });

  it("desde un párrafo suelto, Tab entra al guion por el encabezado", () => {
    const editor = makeEditor("<p>texto</p>", true);
    editor.commands.focus("end");

    expect(press(editor, "Tab")).toBe(true);
    expect(currentType(editor)).toBe("sceneHeading");
    editor.destroy();
  });

  it("Enter sigue el flujo: personaje → diálogo → acción", () => {
    const editor = makeEditor('<p data-sp="character">KAEL</p>', true);
    editor.commands.focus("end");

    expect(press(editor, "Enter")).toBe(true);
    expect(currentType(editor)).toBe("dialogue");

    editor.commands.insertContent("No deberías estar aquí.");
    press(editor, "Enter");
    expect(currentType(editor)).toBe("action");
    editor.destroy();
  });

  it("Enter en un bloque vacío vuelve a acción: la salida del flujo", () => {
    const editor = makeEditor('<p data-sp="character"></p>', true);
    editor.commands.focus("end");

    expect(press(editor, "Enter")).toBe(true);
    expect(currentType(editor)).toBe("action");
    // Convierte en el sitio: no encadena bloques vacíos.
    expect(editor.state.doc.firstChild!.type.name).toBe("action");
    editor.destroy();
  });

  it('el input rule "INT." abre escena sin borrar lo escrito', () => {
    const editor = makeEditor("<p>INT</p>", true);
    type_(editor, ".");

    expect(editor.state.doc.firstChild!.type.name).toBe("sceneHeading");
    expect(editor.state.doc.textContent).toBe("INT.");
    editor.destroy();
  });

  it("sin el teclado del guion montado, Tab no convierte nada (una novela)", () => {
    const editor = makeEditor("<p>texto</p>");
    editor.commands.focus("end");

    press(editor, "Tab");
    expect(currentType(editor)).toBe("paragraph");
    editor.destroy();
  });

  it("los bloques de guion sobreviven al viaje por HTML", () => {
    const editor = makeEditor(
      '<p data-sp="sceneHeading">INT. CASA - DÍA</p><p data-sp="dialogue">Hola.</p>',
    );
    const reloaded = makeEditor(editor.getHTML());
    expect(nodeNames(reloaded)).toEqual(["sceneHeading", "dialogue"]);
    editor.destroy();
    reloaded.destroy();
  });
});
