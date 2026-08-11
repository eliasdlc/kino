import { Extension, InputRule, Node, mergeAttributes } from "@tiptap/react";

/**
 * Formato de guion (PLAN-11 §6): encabezado de escena, acción, personaje,
 * paréntesis y diálogo, con Tab para ciclar tipos — el patrón de Final Draft.
 *
 * Los cinco nodos se renderizan como `<p data-sp="…">`, así que si el contenido se
 * abre sin la extensión (otro medium, export genérico) degrada a párrafos y no se
 * pierde una sola línea. El "aspecto de guion" es CSS: sangrías y mayúsculas viven
 * en la hoja de estilos, no en el texto guardado.
 */

export const SCREENPLAY_NODE_NAMES = [
  "sceneHeading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
] as const;

export type ScreenplayNodeName = (typeof SCREENPLAY_NODE_NAMES)[number];

export const SCREENPLAY_LABELS: Record<ScreenplayNodeName, string> = {
  sceneHeading: "Encabezado de escena",
  action: "Acción",
  character: "Personaje",
  parenthetical: "Paréntesis",
  dialogue: "Diálogo",
};

/** Qué tipo nace al pulsar Enter desde cada bloque (el flujo de Final Draft). */
const ENTER_FLOW: Record<ScreenplayNodeName, ScreenplayNodeName> = {
  sceneHeading: "action",
  action: "action",
  character: "dialogue",
  parenthetical: "dialogue",
  dialogue: "action",
};

function screenplayNode(name: ScreenplayNodeName) {
  return Node.create({
    name,
    group: "block",
    content: "inline*",
    defining: true,

    parseHTML() {
      // Por encima de la regla `p` del párrafo de StarterKit: si no, todo bloque
      // de guion vuelve del HTML guardado convertido en párrafo.
      return [{ tag: `p[data-sp="${name}"]`, priority: 100 }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "p",
        mergeAttributes(HTMLAttributes, {
          "data-sp": name,
          class: `sp-${name}`,
        }),
        0,
      ];
    },
  });
}

export const SceneHeading = screenplayNode("sceneHeading");
export const Action = screenplayNode("action");
export const Character = screenplayNode("character");
export const Parenthetical = screenplayNode("parenthetical");
export const Dialogue = screenplayNode("dialogue");

export const SCREENPLAY_NODES = [
  SceneHeading,
  Action,
  Character,
  Parenthetical,
  Dialogue,
];

function isScreenplayName(name: string): name is ScreenplayNodeName {
  return (SCREENPLAY_NODE_NAMES as readonly string[]).includes(name);
}

/**
 * Teclado del guion. Se monta solo cuando el medium de la obra es `screenplay`
 * (`MediumManifest.screenplayKeys`): en una novela, Tab no debe convertir nada.
 */
export const ScreenplayKeys = Extension.create({
  name: "screenplayKeys",

  addKeyboardShortcuts() {
    const cycle = (dir: 1 | -1) => () => {
      const editor = this.editor;
      // Tab tiene dueño en tablas y listas; ahí no se toca.
      if (
        editor.isActive("table") ||
        editor.isActive("codeBlock") ||
        editor.isActive("listItem") ||
        editor.isActive("taskItem")
      ) {
        return false;
      }
      const name = editor.state.selection.$from.parent.type.name;
      const index = (SCREENPLAY_NODE_NAMES as readonly string[]).indexOf(name);
      const next =
        index === -1
          ? dir === 1
            ? "sceneHeading"
            : "dialogue"
          : SCREENPLAY_NODE_NAMES[
              (index + dir + SCREENPLAY_NODE_NAMES.length) %
                SCREENPLAY_NODE_NAMES.length
            ];
      return editor.commands.setNode(next);
    };

    return {
      Tab: cycle(1),
      "Shift-Tab": cycle(-1),

      Enter: () => {
        const editor = this.editor;
        const { $from, empty } = editor.state.selection;
        if (!empty) return false;

        const block = $from.parent;
        if (!isScreenplayName(block.type.name)) return false;

        // Bloque vacío → vuelve a acción en el sitio, la salida natural del flujo
        // (evita cadenas de personajes vacíos al dudar qué escribir).
        if (block.content.size === 0) {
          if (block.type.name === "action") return false;
          return editor.commands.setNode("action");
        }

        return editor
          .chain()
          .splitBlock()
          .setNode(ENTER_FLOW[block.type.name])
          .run();
      },
    };
  },

  addInputRules() {
    return [
      // "INT." / "EXT." al empezar la línea abre escena. A diferencia de los
      // input rules de Markdown, el texto NO se borra: forma parte del encabezado.
      new InputRule({
        find: /^(int|ext|est|i\/e)\.$/i,
        handler: ({ range, match, chain }) => {
          // El carácter recién tecleado no está en el documento todavía: el
          // input rule debe reescribir el rango con el texto completo o "INT."
          // se quedaría en "INT". El texto se conserva — es el encabezado.
          chain().insertContentAt(range, match[0]).setNode("sceneHeading").run();
        },
      }),
    ];
  },
});
