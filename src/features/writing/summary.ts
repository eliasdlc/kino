/**
 * Resumen extractivo de capítulo (KIN-143).
 *
 * No escribe nada: **elige frases del propio texto**. Esa es la diferencia que
 * importa, y es la razón por la que esto puede existir sin un LLM y sin costo.
 * Un resumen generado suena mejor, pero puede inventarse un detalle que el
 * capítulo no dice; uno extractivo, como mucho, elige mal — y el autor lo ve al
 * instante porque son sus propias palabras, literales.
 *
 * El criterio es TF clásico: pesan más las frases que concentran el vocabulario
 * característico del capítulo, con un plus para las que nombran entidades del
 * codex (donde pasa algo, suele haber alguien) y para la que abre cada escena.
 */

/** Palabras vacías del español: no dicen nada del capítulo concreto. */
const STOPWORDS = new Set([
  "a", "al", "algo", "algun", "alguna", "algunas", "alguno", "algunos", "ante",
  "antes", "aquel", "aquella", "aquello", "aqui", "asi", "aun", "aunque", "bien",
  "cada", "casi", "como", "con", "contra", "cual", "cuales", "cuando", "cuanto",
  "de", "del", "desde", "donde", "dos", "el", "ella", "ellas", "ello", "ellos",
  "en", "entre", "era", "eran", "eres", "es", "esa", "esas", "ese", "eso",
  "esos", "esta", "estaba", "estaban", "estan", "estar", "estas", "este",
  "esto", "estos", "estoy", "fue", "fueron", "ha", "habia", "habian", "han",
  "hasta", "hay", "la", "las", "le", "les", "lo", "los", "mas", "me", "mi",
  "mientras", "muy", "nada", "ni", "no", "nos", "nunca", "o", "otra", "otras",
  "otro", "otros", "para", "pero", "poco", "por", "porque", "que", "quien",
  "se", "sea", "segun", "ser", "si", "sido", "sin", "sobre", "solo", "son",
  "su", "sus", "tal", "tambien", "tan", "tanto", "te", "tenia", "tiene",
  "tienen", "toda", "todas", "todo", "todos", "tras", "tu", "un", "una", "uno",
  "unos", "y", "ya", "yo",
]);

export interface SummarySentence {
  text: string;
  /** Posición en el capítulo, 0-based. Se devuelve en orden de lectura. */
  position: number;
  /** Entidades del codex nombradas en la frase. */
  entities: string[];
}

export interface SummaryInput {
  /** Texto plano del capítulo. */
  text: string;
  /** Nombres y alias del universo, para reconocer de quién se habla. */
  entityNames?: string[];
  /** Cuántas frases devolver. */
  limit?: number;
}

const MIN_WORDS = 6;
const DEFAULT_LIMIT = 4;

/** Quita acentos y baja a minúsculas: "Niebla" y "niebla" son la misma palabra. */
function normalize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Parte el texto en frases. Se corta en `.`, `!`, `?` y `…` seguidos de espacio,
 * y también en salto de línea: en prosa, un párrafo suelto sin puntuación final
 * sigue siendo una unidad.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
}

function words(sentence: string): string[] {
  return normalize(sentence)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Elige las frases más representativas del capítulo y las devuelve **en orden de
 * lectura**: un resumen desordenado no se puede leer de corrido.
 */
export function summarize({
  text,
  entityNames = [],
  limit = DEFAULT_LIMIT,
}: SummaryInput): SummarySentence[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const tokenized = sentences.map(words);

  // Frecuencia de cada término en todo el capítulo.
  const frequency = new Map<string, number>();
  for (const tokens of tokenized) {
    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  const max = Math.max(1, ...frequency.values());

  const normalizedEntities = entityNames
    .map((name) => ({ name, key: normalize(name.trim()) }))
    .filter((e) => e.key.length >= 3);

  const scored = sentences.map((sentence, i) => {
    const tokens = tokenized[i]!;
    const wordCount = sentence.split(/\s+/).length;
    const haystack = normalize(sentence);
    const entities = normalizedEntities
      .filter((e) => haystack.includes(e.key))
      .map((e) => e.name);

    // Dividir por la raíz del largo evita que gane siempre la frase más larga
    // sin castigar de más a las que de verdad concentran vocabulario.
    const weight =
      tokens.reduce((sum, token) => sum + (frequency.get(token) ?? 0) / max, 0) /
      Math.sqrt(Math.max(1, tokens.length));

    return {
      sentence,
      position: i,
      entities,
      score:
        weight +
        // Donde se nombra a alguien del codex, suele estar pasando algo.
        entities.length * 0.35 +
        // La frase que abre el capítulo casi siempre lo sitúa.
        (i === 0 ? 0.5 : 0),
      // Una frase de tres palabras ("—No.") no resume nada.
      eligible: wordCount >= MIN_WORDS,
    };
  });

  return scored
    .filter((s) => s.eligible)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, Math.max(1, limit))
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ text: s.sentence, position: s.position, entities: s.entities }));
}

/** Términos que más definen el capítulo, para las "palabras clave". */
export function keyTerms(text: string, limit = 8): string[] {
  const counts = new Map<string, { display: string; count: number }>();
  for (const sentence of splitSentences(text)) {
    const raw = sentence.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    for (const token of raw) {
      const key = normalize(token);
      if (key.length < 4 || STOPWORDS.has(key)) continue;
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { display: token.toLowerCase(), count: 1 });
    }
  }
  return Array.from(counts.values())
    .filter((e) => e.count > 1)
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display, "es"))
    .slice(0, limit)
    .map((e) => e.display);
}
