/**
 * Navegador del manuscrito (PLAN-11 §7): el índice del capítulo abierto se
 * *deriva* del contenido: separadores de escena, páginas y paneles del guion,
 * encabezados de escena y títulos. No hay lista paralela que mantener ni renumerar:
 * insertar una escena en el medio reordena el índice solo (D12, derivar > mantener).
 *
 * Trabaja sobre la forma estructural de un nodo ProseMirror, no sobre la clase, para
 * que se pueda probar con objetos planos.
 */

export type OutlineKind = "heading" | "scene" | "page" | "panel";

export interface OutlineItem {
  /** Posición absoluta del bloque en el documento: destino del salto. */
  pos: number;
  kind: OutlineKind;
  label: string;
  /** Sangría en el navegador (0 = raíz). */
  depth: number;
}

export interface OutlineNode {
  type: { name: string };
  textContent: string;
  attrs?: Record<string, unknown> | null;
}

export interface OutlineDoc {
  forEach(fn: (node: OutlineNode, offset: number) => void): void;
}

const SNIPPET_MAX = 42;

/** Primeras palabras de un bloque, para que la entrada diga algo del texto real. */
export function outlineSnippet(text: string): string | null {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > SNIPPET_MAX
    ? `${clean.slice(0, SNIPPET_MAX).trimEnd()}…`
    : clean;
}

function withSnippet(label: string, text: string): string {
  const s = outlineSnippet(text);
  return s ? `${label} · ${s}` : label;
}

export function deriveOutline(doc: OutlineDoc): OutlineItem[] {
  const items: OutlineItem[] = [];
  // La primera escena no tiene separador que la anuncie: solo existe si más
  // adelante aparece al menos un corte.
  const firstScene: OutlineItem = { pos: 0, kind: "scene", label: "Escena 1", depth: 0 };
  let openScene: OutlineItem | null = firstScene;
  let breaks = 0;
  let pages = 0;
  let panels = 0;

  doc.forEach((node, offset) => {
    switch (node.type.name) {
      case "sceneBreak": {
        // El corte guía del plot grid (KIN-141) abre el capítulo: no separa dos
        // escenas, así que no numera una nueva: solo etiqueta la primera.
        if (node.attrs?.leading === true && offset === 0) {
          openScene = firstScene;
          firstScene.pos = offset;
          return;
        }
        breaks += 1;
        const item: OutlineItem = {
          pos: offset,
          kind: "scene",
          label: `Escena ${breaks + 1}`,
          depth: 0,
        };
        items.push(item);
        openScene = item;
        return;
      }

      case "mangaPage": {
        pages += 1;
        items.push({
          pos: offset,
          kind: "page",
          label: withSnippet(`Página ${pages}`, node.textContent),
          depth: 0,
        });
        openScene = null;
        return;
      }

      case "panel": {
        // Solo llegan aquí los paneles de nivel superior (webtoon); los de una
        // página ya están representados por su página.
        panels += 1;
        items.push({
          pos: offset,
          kind: "panel",
          label: withSnippet(`Panel ${panels}`, node.textContent),
          depth: 0,
        });
        openScene = null;
        return;
      }

      case "sceneHeading": {
        items.push({
          pos: offset,
          kind: "scene",
          label: outlineSnippet(node.textContent) ?? "Escena sin título",
          depth: 0,
        });
        openScene = null;
        return;
      }

      case "heading": {
        const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
        items.push({
          pos: offset,
          kind: "heading",
          label: outlineSnippet(node.textContent) ?? "Sin título",
          depth: Math.max(0, level - 1),
        });
        openScene = null;
        return;
      }

      default: {
        // Prosa: la escena recién abierta toma prestadas sus primeras palabras.
        if (!openScene) return;
        const s = outlineSnippet(node.textContent);
        if (!s) return;
        openScene.label = `${openScene.label} · ${s}`;
        openScene = null;
      }
    }
  });

  if (breaks > 0) items.unshift(firstScene);
  return items;
}
