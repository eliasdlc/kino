import { Extension, InputRule } from "@tiptap/react";

/**
 * `[texto](url)` se convierte en enlace al cerrar el paréntesis.
 *
 * La marca Link ya viene montada con StarterKit, pero sin regla de entrada: la
 * extensión oficial sólo enlaza al pegar una URL sobre una selección y al
 * escribir una URL desnuda. La sintaxis de Markdown, que es la que la gente
 * escribe, se quedaba como texto literal.
 *
 * No se usa `markInputRule` de Tiptap porque marca el **último** grupo de
 * captura, y en Markdown el último es la URL: marcaría el enlace sobre la
 * dirección en vez de sobre el texto.
 */

import { MARKDOWN_LINK, parseMarkdownLink } from "./link-markdown";

export const LinkMarkdown = Extension.create({
  name: "linkMarkdown",

  addInputRules() {
    const type = this.editor.schema.marks.link;
    if (!type) return [];

    return [
      new InputRule({
        find: MARKDOWN_LINK,
        handler: ({ state, range, match }) => {
          const link = parseMarkdownLink(match[1], match[2]);
          // Lo que no se pueda servir se queda como texto, sin tocar nada.
          if (!link) return null;

          const { tr } = state;
          tr.insertText(link.text, range.from, range.to);
          tr.addMark(range.from, range.from + link.text.length, type.create({ href: link.href }));
          // Sin esto, lo que se escriba después del enlace sigue siendo enlace.
          tr.removeStoredMark(type);
          return null;
        },
      }),
    ];
  },
});
