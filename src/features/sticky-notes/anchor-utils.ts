import type { Editor } from "@tiptap/react";
import type { Node as PmNode } from "@tiptap/pm/model";

/** Un trozo del documento, en posiciones de ProseMirror. */
export interface AnchorRange {
  from: number;
  to: number;
}

/**
 * Todos los trozos que llevan la marca `anchorId`.
 *
 * Son varios y no uno: una seleccion que cruza un `<strong>` o un enlace se
 * parte en varios nodos de texto, y la marca se escribe una vez por nodo. Con
 * un solo rango, quitarla dejaba la mitad puesta.
 */
export function findAnchorRanges(doc: PmNode, anchorId: string): AnchorRange[] {
  const ranges: AnchorRange[] = [];
  doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type.name === "stickyAnchor" && mark.attrs.anchorId === anchorId) {
        ranges.push({ from: pos, to: pos + node.nodeSize });
        return false;
      }
    }
    return undefined;
  });
  return ranges;
}

/** El primero de esos trozos, que es por donde empieza la frase anclada. */
export function findAnchorRange(doc: PmNode, anchorId: string): AnchorRange | null {
  return findAnchorRanges(doc, anchorId)[0] ?? null;
}

/** Quita del documento todos los trozos marcados con ese `anchorId`. */
export function removeAnchorMark(editor: Editor, anchorId: string): void {
  const markType = editor.schema.marks.stickyAnchor;
  if (!markType) return;
  const ranges = findAnchorRanges(editor.state.doc, anchorId);
  if (ranges.length === 0) return;
  // Un solo paso para todos los rangos: quitar una marca no mueve ninguna
  // posicion, asi que los rangos siguen valiendo dentro de la misma tr.
  const tr = editor.state.tr;
  for (const range of ranges) tr.removeMark(range.from, range.to, markType);
  editor.view.dispatch(tr);
}

/**
 * Escribe la marca sobre un trozo concreto. `muted` la deja sin decoracion:
 * es un ancla de posicion, no una anotacion de ese texto.
 */
export function applyAnchorMarkOnRange(
  editor: Editor,
  range: AnchorRange,
  anchorId: string,
  muted = false
): void {
  const markType = editor.state.schema.marks.stickyAnchor;
  if (!markType || range.from >= range.to) return;
  editor.view.dispatch(
    editor.state.tr.addMark(range.from, range.to, markType.create({ anchorId, muted }))
  );
}

/**
 * Escribe una marca stickyAnchor en `pos`, sobre el nodo inline que empieza
 * ahi. `muted` la deja sin decoracion: es un ancla de posicion, no una
 * anotacion de ese texto.
 */
export function applyAnchorMarkAtPos(
  editor: Editor,
  pos: number,
  anchorId: string,
  muted = false
): void {
  const { doc, schema } = editor.state;
  if (!schema.marks.stickyAnchor) return;

  const $pos = doc.resolve(pos);
  const despues = $pos.nodeAfter;
  const antes = $pos.nodeBefore;

  // Si hay texto delante, se marca ese. Si no lo hay, el punto cayo al final de
  // la linea, que es lo normal cuando pegas la nota a la altura de un parrafo
  // corto: el centro de la columna queda pasada su ultima letra. Ahi se marca
  // el texto de detras. Sin esta segunda rama la marca no se escribia y la nota
  // se quedaba con un ancla que no existia, asi que volvia a deslizarse.
  let from: number;
  let to: number;
  if (despues && !despues.isBlock) {
    from = pos;
    to = Math.min(pos + despues.nodeSize, $pos.end());
  } else if (antes && !antes.isBlock) {
    from = Math.max(pos - antes.nodeSize, $pos.start());
    to = pos;
  } else {
    return;
  }

  applyAnchorMarkOnRange(editor, { from, to }, anchorId, muted);
}

/** Un trozo del texto plano. `from` es `null` en el hueco entre dos bloques. */
interface Pieza {
  from: number | null;
  texto: string;
}

/**
 * El texto plano del documento, con el sitio de cada trozo.
 *
 * El salto entre bloques entra como un espacio sin sitio, que es lo que mete
 * `doc.textBetween(from, to, " ")`, de donde sale el `textAnchor` que guarda
 * una nota. Los dos textos tienen que coincidir caracter a caracter para poder
 * buscar uno dentro del otro.
 */
function piezasDeTexto(doc: PmNode): Pieza[] {
  const piezas: Pieza[] = [];
  let huecoPendiente = false;
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      if (huecoPendiente) {
        piezas.push({ from: null, texto: " " });
        huecoPendiente = false;
      }
      piezas.push({ from: pos, texto: node.text });
      return false;
    }
    if (node.isBlock && piezas.length > 0) huecoPendiente = true;
    return undefined;
  });
  return piezas;
}

/**
 * El sitio del documento que corresponde a un desplazamiento del texto plano.
 * `final` decide a que lado cae un desplazamiento que toca la junta entre dos
 * trozos: el principio de una frase es del trozo que empieza, el final es del
 * que acaba.
 */
function sitioDe(piezas: Pieza[], offset: number, final: boolean): number | null {
  let base = 0;
  for (const pieza of piezas) {
    const fin = base + pieza.texto.length;
    const dentro = final ? offset > base && offset <= fin : offset >= base && offset < fin;
    if (dentro) return pieza.from === null ? null : pieza.from + (offset - base);
    base = fin;
  }
  return null;
}

/**
 * Vuelve a marcar la frase `texto` con `anchorId`, buscandola en el documento.
 *
 * Es el camino de vuelta de una nota restaurada desde la papelera: borrarla
 * retiro su marca, y al volver hay que encontrar su frase otra vez. Devuelve
 * `null` si el texto ya no esta, y entonces la nota cae sobre `positionY`, que
 * es su respaldo. Marca la primera aparicion: con la frase repetida en el
 * documento no hay forma de saber cual era la suya.
 */
export function applyAnchorMarkOnText(
  editor: Editor,
  texto: string,
  anchorId: string,
  muted = false
): AnchorRange | null {
  if (!texto) return null;
  const piezas = piezasDeTexto(editor.state.doc);
  const inicio = piezas.map((p) => p.texto).join("").indexOf(texto);
  if (inicio === -1) return null;

  const from = sitioDe(piezas, inicio, false);
  const to = sitioDe(piezas, inicio + texto.length, true);
  if (from === null || to === null || from >= to) return null;

  applyAnchorMarkOnRange(editor, { from, to }, anchorId, muted);
  return { from, to };
}

/**
 * A que altura, en pixeles dentro del contenedor, esta el ancla ahora mismo.
 * `null` si la marca ya no existe (el texto que la llevaba se borro).
 *
 * Devuelve pixeles y no una fraccion a proposito. Una fraccion hay que
 * multiplicarla luego por la altura del contenedor, y esas dos alturas no
 * siempre son la misma: la marca se mide cuando el editor avisa de un cambio y
 * la altura del contenedor la trae un ResizeObserver que llega despues, asi que
 * el viaje de ida y vuelta metia un error proporcional al crecimiento del
 * documento. Medido antes de esto: 102 px de desvio al escribir tres parrafos.
 */
export function getAnchorTop(
  editor: Editor,
  anchorId: string,
  container: HTMLElement
): number | null {
  const range = findAnchorRange(editor.state.doc, anchorId);
  if (!range) return null;

  let coords: { top: number };
  try {
    coords = editor.view.coordsAtPos(range.from);
  } catch {
    return null;
  }

  return coords.top - container.getBoundingClientRect().top;
}
