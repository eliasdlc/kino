import { Node, mergeAttributes } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import type { ResolvedPos } from "@tiptap/pm/model";

/**
 * Guion por páginas y paneles: manga, cómic y webtoon (PLAN-11 §6). Una página
 * contiene paneles; cada panel es un beat con su descripción visual, diálogos y
 * SFX escritos como párrafos.
 *
 * La numeración NO se persiste: se dibuja con contadores CSS y se recalcula por
 * posición al exportar. Un panel insertado en medio renumera solo — es la regla
 * "derivar > mantener" (D12) aplicada a la estructura del guion.
 *
 * El webtoon (scroll vertical, sin páginas) usa `panel` suelto en el documento:
 * por eso `panel` pertenece al grupo `block` y no solo al contenido de la página.
 */

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    manga: {
      insertMangaPage: () => ReturnType;
      insertPanel: () => ReturnType;
    };
  }
}

export const MangaPage = Node.create({
  name: "mangaPage",
  group: "block",
  content: "panel+",
  defining: true,

  parseHTML() {
    return [{ tag: "section[data-manga-page]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-manga-page": "",
        class: "manga-page",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertMangaPage:
        () =>
        ({ state, tr, dispatch, chain }) => {
          const page = state.schema.nodes.mangaPage?.createAndFill();
          if (!page) return false;

          // Estando ya dentro del guion, la página nace *detrás* del bloque
          // actual: insertarla en el cursor la metería dentro de un panel.
          const { $from } = state.selection;
          const top = $from.depth >= 1 ? $from.node(1).type.name : null;
          if (top !== "mangaPage" && top !== "panel") {
            return chain()
              .insertContent({
                type: this.name,
                content: [{ type: "panel", content: [{ type: "paragraph" }] }],
              })
              .focus()
              .run();
          }

          if (!dispatch) return true;
          const at = $from.after(1);
          tr.insert(at, page);
          // +3: dentro de la página → dentro del panel → dentro del párrafo.
          tr.setSelection(TextSelection.near(tr.doc.resolve(at + 3)));
          dispatch(tr.scrollIntoView());
          return true;
        },
    };
  },
});

/** Sube por el árbol hasta el `panel` que contiene la posición, si lo hay. */
function panelDepthAt($pos: ResolvedPos): number | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === "panel") return depth;
  }
  return null;
}

export const Panel = Node.create({
  name: "panel",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "article[data-panel]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "article",
      mergeAttributes(HTMLAttributes, { "data-panel": "", class: "panel" }),
      0,
    ];
  },

  addCommands() {
    return {
      insertPanel:
        () =>
        ({ state, tr, dispatch, chain }) => {
          const panel = state.schema.nodes.panel?.createAndFill();
          if (!panel) return false;

          // Dentro de un panel, el nuevo va detrás como hermano — nunca anidado.
          const { $from } = state.selection;
          const depth = panelDepthAt($from);
          if (depth === null) {
            return chain()
              .insertContent({ type: this.name, content: [{ type: "paragraph" }] })
              .focus()
              .run();
          }

          if (!dispatch) return true;
          const at = $from.after(depth);
          tr.insert(at, panel);
          tr.setSelection(TextSelection.near(tr.doc.resolve(at + 2)));
          dispatch(tr.scrollIntoView());
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      /**
       * Enter dentro de un panel nunca te saca del guion por sorpresa: en el
       * párrafo vacío final encadena el siguiente panel (PLAN-11 §6), y si ese
       * párrafo era lo único del panel, sale a prosa. En cualquier otro punto
       * parte la línea dentro del panel — sin esto, el `liftEmptyBlock` del
       * keymap base expulsaría el párrafo vacío fuera de la página entera.
       */
      Enter: () =>
        this.editor.commands.command(({ state, tr, dispatch, commands }) => {
          const { $from, empty } = state.selection;
          if (!empty) return false;

          const para = $from.parent;
          if (para.type.name !== "paragraph" || para.content.size > 0) return false;

          const panelDepth = panelDepthAt($from);
          if (panelDepth === null || panelDepth !== $from.depth - 1) return false;

          const panel = $from.node(panelDepth);
          const panelType = state.schema.nodes.panel;
          const paragraphType = state.schema.nodes.paragraph;
          if (!panelType || !paragraphType) return false;

          // Párrafo vacío en medio del panel: línea nueva, se queda dentro. Se
          // usa el `commands` del propio comando —no el del editor— para no
          // despachar una transacción paralela a la que ya está en curso.
          if ($from.index(panelDepth) !== panel.childCount - 1) {
            return commands.splitBlock();
          }

          if (!dispatch) return true;

          // Panel con contenido real → nace el siguiente panel hermano.
          if (panel.childCount > 1) {
            const newPanel = panelType.createAndFill();
            if (!newPanel) return false;
            const panelEnd = $from.after(panelDepth);
            tr.delete($from.before(), $from.after());
            const insertAt = tr.mapping.map(panelEnd);
            tr.insert(insertAt, newPanel);
            tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 2)));
            dispatch(tr.scrollIntoView());
            return true;
          }

          // Panel vacío → salir. Si además era el único panel de su página, la
          // página se va con él en vez de quedar como un contenedor huérfano.
          const parent = $from.node(panelDepth - 1);
          const inPageWithSiblings =
            parent.type.name === "mangaPage" && parent.childCount > 1;
          const dropDepth = parent.type.name === "mangaPage" && !inPageWithSiblings
            ? panelDepth - 1
            : panelDepth;
          const from = $from.before(dropDepth);
          const to = $from.after(dropDepth);

          if (inPageWithSiblings) {
            // La página solo admite paneles: el párrafo de salida cae detrás.
            const afterPage = $from.after(panelDepth - 1);
            tr.delete(from, to);
            const landing = tr.mapping.map(afterPage);
            tr.insert(landing, paragraphType.create());
            tr.setSelection(TextSelection.near(tr.doc.resolve(landing + 1)));
          } else {
            // `replaceWith` en vez de delete+insert: borrar el último bloque del
            // documento dispara el autorrelleno del schema y saldrían dos párrafos.
            tr.replaceWith(from, to, paragraphType.create());
            tr.setSelection(TextSelection.near(tr.doc.resolve(from + 1)));
          }

          dispatch(tr.scrollIntoView());
          return true;
        }),
    };
  },
});
