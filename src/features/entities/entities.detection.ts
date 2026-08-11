/**
 * Auto-detección determinística de menciones (Writing W2, sin LLM).
 *
 * Escanea el texto plano de un capítulo contra los `name` + `aliases` de las
 * entidades del universo y devuelve cuántas veces aparece cada una. Es la fuente
 * de verdad que materializa `page_entity_mentions` al guardar la page — captura
 * tanto las menciones explícitas `@` (que se renderizan con el nombre) como las
 * apariciones textuales sueltas.
 *
 * Reglas: case-insensitive, respeta límites de palabra (unicode: "Kael" no cuenta
 * dentro de "Kaelthas"), soporta alias multi-palabra ("Sombrero de Paja"). Los
 * términos más largos y específicos ganan y consumen su rango, así un nombre que
 * contiene a su alias no se cuenta dos veces.
 */

export interface DetectableEntity {
  id: string;
  name: string;
  aliases?: string[] | null;
}

/**
 * Texto plano completo del HTML de Tiptap para escanear menciones. A diferencia
 * de `stripHtml` de pages (que trunca a 300 para el preview), preserva todo el
 * cuerpo del capítulo.
 */
export function plainTextFromHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\/?(p|li|h[1-6]|br|div|blockquote|td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿La posición marca un límite de palabra? (fuera de rango o carácter no alfanumérico). */
function isBoundary(text: string, pos: number): boolean {
  if (pos < 0 || pos >= text.length) return true;
  return !/[\p{L}\p{N}]/u.test(text[pos]);
}

/**
 * Devuelve un mapa entityId → número de apariciones (solo entidades con conteo > 0).
 */
export function detectMentions(
  plainText: string,
  entities: DetectableEntity[],
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!plainText || !plainText.trim() || entities.length === 0) return counts;

  // Términos (name + aliases), más largos primero: lo específico gana y evita
  // el doble conteo cuando un nombre contiene a su propio alias.
  const terms: Array<{ entityId: string; term: string }> = [];
  for (const entity of entities) {
    const seen = new Set<string>();
    for (const raw of [entity.name, ...(entity.aliases ?? [])]) {
      const term = raw?.trim();
      if (!term) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push({ entityId: entity.id, term });
    }
  }
  terms.sort((a, b) => b.term.length - a.term.length);

  const lower = plainText.toLowerCase();
  const consumed = new Array<boolean>(plainText.length).fill(false);

  for (const { entityId, term } of terms) {
    const needle = term.toLowerCase();
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      from = idx + 1;

      if (!isBoundary(plainText, idx - 1) || !isBoundary(plainText, end)) continue;

      let overlaps = false;
      for (let i = idx; i < end; i++) {
        if (consumed[i]) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      for (let i = idx; i < end; i++) consumed[i] = true;
      counts.set(entityId, (counts.get(entityId) ?? 0) + 1);
    }
  }

  return counts;
}
