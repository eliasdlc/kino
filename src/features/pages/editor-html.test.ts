import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { StickyAnchorMark } from "@/features/sticky-notes/sticky-anchor.extension";
import { MEDIUM_CONFIG } from "@/shared/lib/mediums";
import { sanitizePageHtml } from "@/shared/lib/sanitize";
import { ImageUrlPaste } from "./image-paste.extension";
import { CodexMention } from "./codex-mention.extension";
import { mediumExtensions } from "./mediums/medium-extensions";

/**
 * El contrato entre el editor y el saneo del render: todo lo que el editor
 * serializa tiene que sobrevivir intacto.
 *
 * `sanitizePageHtml` corta por lista blanca, así que una extensión nueva cuyo
 * `renderHTML` emita una etiqueta o un atributo que nadie abrió se vería
 * perfecta en el editor y desaparecería en el modo lectura. Esa clase de bug no
 * la ve nadie hasta que alguien abre un capítulo viejo. Aquí se cae antes.
 *
 * Se compara contra el `getHTML()` de un editor real, no contra HTML escrito a
 * mano: la afirmación es sobre lo que el editor produce hoy, no sobre lo que
 * creemos que produce.
 */
function editorHtml(content: string, medium: keyof typeof MEDIUM_CONFIG | null = null): string {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Typography,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageUrlPaste.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-2" },
      }),
      StickyAnchorMark,
      CodexMention.configure({ systemId: "sys-1", HTMLAttributes: {} }),
      ...mediumExtensions(medium ? MEDIUM_CONFIG[medium] : null),
    ],
    content,
  });

  const html = editor.getHTML();
  editor.destroy();
  return html;
}

/**
 * Reserializa por el parser del navegador. Tiptap y el saneador escriben lo
 * mismo de formas distintas (`<hr>` contra `<hr />`, `data-panel` contra
 * `data-panel=""`), y comparar cadenas crudas convertiría esa diferencia
 * cosmética en una falla. Pasando los dos lados por el mismo parser, lo único
 * que puede diferir es que el saneo haya quitado algo de verdad.
 */
function normalize(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  // El `style` es la excepción: el DOM no normaliza su texto, y Tiptap escribe
  // `min-width: 50px;` donde el saneador escribe `min-width:50px`. Reescribirlo
  // por `cssText` iguala la forma sin tapar una declaración perdida.
  host.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    el.setAttribute("style", el.style.cssText);
  });
  return host.innerHTML;
}

/** Cada caso es un trozo de capítulo real, cargado y vuelto a serializar. */
const DOCUMENTS: Array<{ name: string; content: string; medium?: keyof typeof MEDIUM_CONFIG }> = [
  {
    name: "encabezados y formato",
    content:
      "<h1>Uno</h1><h2>Dos</h2><h3>Tres</h3>" +
      "<p><strong>negrita</strong> <em>cursiva</em> <s>tachado</s> <code>código</code></p>" +
      "<blockquote><p>una cita</p></blockquote><hr>",
  },
  {
    name: "listas",
    content: "<ul><li><p>uno</p></li><li><p>dos</p></li></ul><ol><li><p>primero</p></li></ol>",
  },
  {
    name: "lista de tareas",
    content:
      '<ul data-type="taskList">' +
      '<li data-type="taskItem" data-checked="true"><p>hecho</p></li>' +
      '<li data-type="taskItem" data-checked="false"><p>pendiente</p></li>' +
      "</ul>",
  },
  {
    name: "bloque de código",
    content: "<pre><code>const a = 1;</code></pre>",
  },
  {
    name: "tabla con cabecera y celdas combinadas",
    content:
      "<table><tbody>" +
      "<tr><th>A</th><th>B</th></tr>" +
      '<tr><td colspan="2"><p>fusionada</p></td></tr>' +
      "</tbody></table>",
  },
  {
    name: "imagen y enlace",
    content:
      '<p><img src="https://blob.test/a.png" alt="portada" title="portada"></p>' +
      '<p><a href="https://usekino.dev" rel="noopener noreferrer">Kino</a></p>',
  },
  {
    name: "ancla de nota adhesiva",
    content: '<p><span data-anchor-id="nota-1">el párrafo anotado</span></p>',
  },
  {
    name: "mención del Codex",
    content:
      '<p><span data-entity-id="e-1" data-label="La Daga" data-entity-type="object">@La Daga</span></p>',
  },
  {
    name: "corte de escena",
    content: '<div data-scene-break data-arc="acto 2"></div>',
    medium: "novel",
  },
  {
    name: "guion",
    content:
      '<p data-sp="scene">INT. CASA - NOCHE</p>' +
      '<p data-sp="character">ELIAS</p>' +
      '<p data-sp="dialogue">No hay tiempo.</p>',
    medium: "screenplay",
  },
  {
    name: "página de manga",
    content:
      '<section data-manga-page><article data-panel class="panel"><p>viñeta</p></article></section>',
    medium: "manga",
  },
];

describe("el saneo del render no toca nada de lo que el editor produce", () => {
  for (const { name, content, medium } of DOCUMENTS) {
    it(name, () => {
      const html = editorHtml(content, medium ?? null);
      expect(html, "el editor no serializó nada, el caso no prueba nada").not.toBe("<p></p>");
      expect(normalize(sanitizePageHtml(html))).toBe(normalize(html));
    });
  }
});

describe("el editor no es la defensa", () => {
  it("carga y vuelve a serializar el HTML que le den, pero el saneo lo corta", () => {
    // ProseMirror descarta un `<script>` al parsear, así que el editor por sí
    // solo parece seguro. Lo que llega por el MCP nunca pasa por este parser:
    // se guarda tal cual y el modo lectura lo pinta. De ahí que la garantía
    // tenga que estar en `sanitizePageHtml` y no aquí.
    const raw = '<p>capítulo</p><img src="x" onerror="alert(1)">';
    expect(sanitizePageHtml(raw)).not.toContain("onerror");
  });
});
