/**
 * Encontrar una cita dentro de un texto, aunque el texto no sea idéntico.
 *
 * Es el `TextQuoteSelector` de la anotación web del W3C (`exact`, `prefix`,
 * `suffix`), que es como Hypothesis ancla sus notas: el agente que revisa un
 * documento ve texto, no posiciones de ProseMirror, así que cita lo que leyó y
 * el ancla se resuelve aquí. Lo usan los dos lados con la misma regla: el
 * servidor para rechazar una cita que no existe antes de guardarla, y el
 * editor para pintar el resaltado.
 *
 * La comparación perdona lo que cambia entre el markdown que el agente lee y el
 * HTML que el editor guarda: espacios y saltos, comillas tipográficas, guiones,
 * puntos suspensivos, mayúsculas y los marcadores de énfasis de markdown.
 */

/** Lo que cita quien comenta: el fragmento exacto y, si se repite, lo que lo rodea. */
export interface TextQuote {
  exact: string;
  prefix?: string | null;
  suffix?: string | null;
}

export type QuoteMatch =
  | { status: "found"; start: number; end: number }
  | { status: "missing" }
  | { status: "ambiguous"; count: number };

/** Texto comparable, y para cada carácter el índice del original del que sale. */
export interface NormalizedText {
  text: string;
  origin: number[];
}

/** Caracteres que se reescriben a su forma llana antes de comparar. */
const EQUIVALENTES: Record<string, string> = {
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u00AB": '"',
  "\u00BB": '"',
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": "'",
  "`": "'",
  "\u2013": "-",
  "\u2014": "-",
  "\u2011": "-",
  "\u2026": "...",
};

/** Marcadores de markdown que el agente puede arrastrar al citar y el editor no guarda. */
const IGNORADOS = new Set(["*", "_", "\\"]);

export function normalizeForMatch(input: string): NormalizedText {
  let text = "";
  const origin: number[] = [];
  let enBlanco = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (/\s/u.test(ch)) {
      if (!enBlanco && text.length > 0) {
        text += " ";
        origin.push(i);
      }
      enBlanco = true;
      continue;
    }
    if (IGNORADOS.has(ch)) continue;
    enBlanco = false;
    const llano = EQUIVALENTES[ch] ?? ch;
    for (const c of llano) {
      const lower = c.toLowerCase();
      text += lower.length === 1 ? lower : c;
      origin.push(i);
    }
  }
  // Un blanco al final no sale de ningún carácter que importe.
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    origin.pop();
  }
  return { text, origin };
}

/** Cuántos caracteres comparten el final de `a` y el final de `b`. */
function finalComun(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

/** Cuántos caracteres comparten el principio de `a` y el de `b`. */
function principioComun(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Dónde está la cita en `source`, en índices de `source`.
 *
 * Si aparece una sola vez, ahí. Si se repite, gana la aparición cuyo contexto
 * se parece más a `prefix` y `suffix`; un empate es `ambiguous`, porque anclar
 * al azar es peor que pedir más contexto.
 */
export function locateQuote(source: string, quote: TextQuote): QuoteMatch {
  const haystack = normalizeForMatch(source);
  const needle = normalizeForMatch(quote.exact).text;
  if (!needle) return { status: "missing" };

  const hits: number[] = [];
  for (let at = haystack.text.indexOf(needle); at !== -1; at = haystack.text.indexOf(needle, at + 1)) {
    hits.push(at);
  }
  if (hits.length === 0) return { status: "missing" };

  let best = hits[0]!;
  if (hits.length > 1) {
    const prefix = normalizeForMatch(quote.prefix ?? "").text;
    const suffix = normalizeForMatch(quote.suffix ?? "").text;
    const puntos = hits.map((at) => {
      const antes = haystack.text.slice(Math.max(0, at - prefix.length - 1), at).trimEnd();
      const despues = haystack.text.slice(at + needle.length, at + needle.length + suffix.length + 1).trimStart();
      return (prefix ? finalComun(antes, prefix) : 0) + (suffix ? principioComun(despues, suffix) : 0);
    });
    const max = Math.max(...puntos);
    if (max === 0 || puntos.filter((p) => p === max).length > 1) {
      return { status: "ambiguous", count: hits.length };
    }
    best = hits[puntos.indexOf(max)]!;
  }

  return {
    status: "found",
    start: haystack.origin[best]!,
    end: haystack.origin[best + needle.length - 1]! + 1,
  };
}

/** Entidades de HTML que el editor escribe al guardar. */
const ENTIDADES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

/**
 * El texto que se lee en un HTML de página, con un blanco donde acaba cada
 * bloque. Sirve para buscar citas en el servidor, que no tiene ProseMirror: no
 * reproduce el documento, sólo lo que hace falta para que la misma cita se
 * encuentre a los dos lados.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\/?(p|li|h[1-6]|br|div|blockquote|td|th|tr|pre)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entidad, nombre: string) => {
      const lower = nombre.toLowerCase();
      if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith("#") && lower !== "#39") return String.fromCodePoint(parseInt(lower.slice(1), 10));
      return ENTIDADES[lower] ?? entidad;
    });
}
