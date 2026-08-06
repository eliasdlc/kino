import { Node, mergeAttributes, nodeInputRule } from "@tiptap/react";

/**
 * Separador de escena de la novela (PLAN-11 §6). Es el corte visible dentro de un
 * capítulo — la unidad que el navegador del manuscrito convierte en escenas
 * navegables (derivadas del contenido, nunca una lista mantenida a mano).
 *
 * Se renderiza como `<div data-scene-break>` en vez de reutilizar el `<hr>` de
 * StarterKit para poder distinguirlo de una línea divisoria normal al derivar el
 * outline y al exportar. Sin la extensión montada, el HTML guardado degrada a un
 * párrafo con `* * *`: el corte se lee igual, no se pierde contenido.
 */

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    sceneBreak: {
      setSceneBreak: () => ReturnType;
    };
  }
}

export const SCENE_BREAK_GLYPH = "* * *";

export const SceneBreak = Node.create({
  name: "sceneBreak",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      // Arco narrativo de la escena que este corte abre (KIN-141). Vive aquí, en
      // el texto, y no en una tabla aparte: el plot grid reordena escribiendo de
      // vuelta en el contenido, así que no hay una segunda fuente que pueda
      // divergir de lo escrito.
      arc: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-arc"),
        renderHTML: (attrs) =>
          attrs.arc ? { "data-arc": attrs.arc as string } : {},
      },
      // Corte que abre el capítulo: existe solo para cargar el arco de la primera
      // escena, así que no se pinta. Sin esto, ponerle arco a la primera escena
      // metería un `* * *` al principio del capítulo.
      leading: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-leading") === "true",
        renderHTML: (attrs) => (attrs.leading ? { "data-leading": "true" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-scene-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-scene-break": "",
        class: "scene-break",
      }),
      SCENE_BREAK_GLYPH,
    ];
  },

  renderText() {
    return SCENE_BREAK_GLYPH;
  },

  addCommands() {
    return {
      setSceneBreak:
        () =>
        ({ chain }) =>
          // Separador y párrafo entran en una sola inserción: encadenar dos
          // `insertContent` haría que el segundo recalcule el rango sobre la
          // selección vieja y se comiera el separador.
          chain()
            .insertContent([{ type: this.name }, { type: "paragraph" }])
            .focus()
            .run(),
    };
  },

  addInputRules() {
    return [
      // `* * * ` (con espacios). El `*** ` de StarterKit sigue siendo un <hr>.
      nodeInputRule({ find: /^\*\s\*\s\*\s$/, type: this.type }),
    ];
  },
});
