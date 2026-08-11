/**
 * Plot grid (KIN-141): las escenas de una obra como tarjetas en una rejilla de
 * capítulo × arco narrativo.
 *
 * **La tensión de diseño y cómo se resolvió.** Las escenas son derivadas del
 * texto (por `sceneBreak`) y eso es deliberado: nada que se desincronice. Un
 * tablero que permite reordenar tiene dos salidas — escribir de vuelta en el
 * contenido, o persistir un orden paralelo que puede divergir del texto. Aquí se
 * escribe de vuelta en el contenido, siempre. Mover una tarjeta reescribe el HTML
 * de los capítulos implicados; el arco vive como atributo del propio corte de
 * escena. No hay una segunda fuente de verdad que pueda mentir.
 *
 * Todo es manipulación de strings, sin DOM: el corte de escena es un átomo
 * (`<div data-scene-break>* * *</div>`) sin nada anidado, así que partir por él es
 * seguro y el mismo código sirve en el servidor —donde no hay `DOMParser`— y en
 * los tests.
 */

/** Un corte de escena tal cual lo renderiza la extensión de Tiptap. */
const BREAK_RE = /<div\b[^>]*\bdata-scene-break\b[^>]*>[\s\S]*?<\/div>/g;

export interface Scene {
  /** Posición dentro del capítulo, 0-based. */
  index: number;
  /** Arco narrativo al que pertenece; `null` = sin asignar. */
  arc: string | null;
  /** Cuerpo de la escena, sin la marca de corte que la abre. */
  html: string;
  /** Tiene un corte propio delante. La primera escena puede no tenerlo. */
  hasBreak: boolean;
  /**
   * Su corte abre el capítulo y no debe pintarse: es una marca de arco, no un
   * separador entre dos escenas. Se oculta en el editor, en la lectura y en el
   * export.
   */
  leading: boolean;
}

export interface ChapterScenes {
  chapterId: string;
  title: string | null;
  scenes: Scene[];
}

const ATTR_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeAttr(raw: string): string {
  return raw.replace(/[&<>"]/g, (ch) => ATTR_ESCAPES[ch]!);
}

function unescapeAttr(raw: string): string {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function readAttr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return match ? unescapeAttr(match[1]!) : null;
}

export const SCENE_BREAK_GLYPH = "* * *";

/** Vuelve a escribir el corte de una escena con su arco y su condición de guía. */
export function renderSceneBreak(arc: string | null, leading: boolean): string {
  const attrs = [
    'data-scene-break=""',
    'class="scene-break"',
    ...(arc ? [`data-arc="${escapeAttr(arc)}"`] : []),
    ...(leading ? ['data-leading="true"'] : []),
  ];
  return `<div ${attrs.join(" ")}>${SCENE_BREAK_GLYPH}</div>`;
}

/** Parte el HTML de un capítulo en sus escenas. */
export function splitScenes(html: string | null): Scene[] {
  const source = html ?? "";
  if (source.trim() === "") return [];

  const matches = Array.from(source.matchAll(BREAK_RE));
  const scenes: Scene[] = [];

  const preamble = source.slice(0, matches[0]?.index ?? source.length);
  if (preamble.trim() !== "") {
    scenes.push({ index: 0, arc: null, html: preamble, hasBreak: false, leading: false });
  }

  matches.forEach((match, i) => {
    const tag = match[0];
    const start = match.index! + tag.length;
    const end = matches[i + 1]?.index ?? source.length;
    scenes.push({
      index: scenes.length,
      arc: readAttr(tag, "data-arc"),
      html: source.slice(start, end),
      hasBreak: true,
      leading: readAttr(tag, "data-leading") === "true",
    });
  });

  return scenes;
}

/**
 * Rehace el HTML del capítulo. Normaliza los cortes por posición: la primera
 * escena nunca enseña separador (si lleva corte, es solo para cargar su arco) y
 * el resto siempre lo lleva — así el texto no puede quedar con un `* * *` de más
 * o de menos después de mover una tarjeta.
 */
export function joinScenes(scenes: Scene[]): string {
  return scenes
    .map((scene, i) => {
      const first = i === 0;
      // Una primera escena sin arco no necesita corte ninguno.
      const needsBreak = first ? scene.arc !== null : true;
      const mark = needsBreak ? renderSceneBreak(scene.arc, first) : "";
      return `${mark}${scene.html}`;
    })
    .join("");
}

/** Reindexa y normaliza las banderas de una lista de escenas. */
function normalize(scenes: Scene[]): Scene[] {
  return scenes.map((scene, i) => ({
    ...scene,
    index: i,
    hasBreak: i === 0 ? scene.arc !== null : true,
    leading: i === 0 && scene.arc !== null,
  }));
}

export interface SceneRef {
  chapterId: string;
  index: number;
}

/**
 * Dónde acaba de verdad una escena movida, después de acotar el índice y de
 * descontar el hueco que deja al salir si el capítulo es el mismo.
 *
 * Es su propia función porque el llamador la necesita: para ponerle el arco a la
 * escena recién movida hay que saber en qué posición cayó, y adivinarlo por fuera
 * sería tener la regla escrita en dos sitios.
 */
export function insertIndexFor(
  chapters: ChapterScenes[],
  from: SceneRef,
  to: { chapterId: string; index: number },
): number {
  const source = chapters.find((c) => c.chapterId === from.chapterId);
  const target = chapters.find((c) => c.chapterId === to.chapterId);
  if (!source || !target) return to.index;

  const sameChapter = from.chapterId === to.chapterId;
  const ceiling = sameChapter ? source.scenes.length - 1 : target.scenes.length;
  // Al mover dentro del mismo capítulo, quitar la escena desplaza las de después:
  // el índice destino se corrige o la tarjeta cae una posición más allá.
  const raw = sameChapter && to.index > from.index ? to.index - 1 : to.index;
  return Math.max(0, Math.min(raw, Math.max(0, ceiling)));
}

/**
 * Mueve una escena a otra posición, dentro del mismo capítulo o a otro. Devuelve
 * los capítulos completos: el llamador escribe de vuelta solo los que cambiaron.
 */
export function moveScene(
  chapters: ChapterScenes[],
  from: SceneRef,
  to: { chapterId: string; index: number },
): ChapterScenes[] {
  const source = chapters.find((c) => c.chapterId === from.chapterId);
  const target = chapters.find((c) => c.chapterId === to.chapterId);
  if (!source || !target) return chapters;

  const scene = source.scenes[from.index];
  if (!scene) return chapters;

  const sameChapter = from.chapterId === to.chapterId;
  const remaining = source.scenes.filter((_, i) => i !== from.index);
  const insertAt = insertIndexFor(chapters, from, to);

  return chapters.map((chapter) => {
    if (sameChapter && chapter.chapterId === from.chapterId) {
      const next = [...remaining];
      next.splice(insertAt, 0, scene);
      return { ...chapter, scenes: normalize(next) };
    }
    if (chapter.chapterId === from.chapterId) {
      return { ...chapter, scenes: normalize(remaining) };
    }
    if (chapter.chapterId === to.chapterId) {
      const next = [...chapter.scenes];
      next.splice(insertAt, 0, scene);
      return { ...chapter, scenes: normalize(next) };
    }
    return chapter;
  });
}

/** Asigna (o quita, con `null`) el arco de una escena. */
export function setSceneArc(
  chapters: ChapterScenes[],
  ref: SceneRef,
  arc: string | null,
): ChapterScenes[] {
  const clean = arc?.trim() || null;
  return chapters.map((chapter) => {
    if (chapter.chapterId !== ref.chapterId) return chapter;
    if (!chapter.scenes[ref.index]) return chapter;
    return {
      ...chapter,
      scenes: normalize(
        chapter.scenes.map((scene, i) => (i === ref.index ? { ...scene, arc: clean } : scene)),
      ),
    };
  });
}

/** Los arcos presentes en la obra, en el orden en que aparecen al leerla. */
export function listArcs(chapters: ChapterScenes[]): string[] {
  const seen: string[] = [];
  for (const chapter of chapters) {
    for (const scene of chapter.scenes) {
      if (scene.arc && !seen.includes(scene.arc)) seen.push(scene.arc);
    }
  }
  return seen;
}

const TAG_RE = /<[^>]+>/g;

/** Primeras palabras de la escena, para que la tarjeta diga algo del texto real. */
export function scenePreview(html: string, max = 140): string {
  const text = html
    .replace(TAG_RE, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}
