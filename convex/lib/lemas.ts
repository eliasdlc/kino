import { newStemmer } from 'snowball-stemmers';

// Lematiza al escribir: el índice de búsqueda de Convex no sabe de idiomas,
// así que cada mutación que guarda título o cuerpo escribe también `lemas`, y
// la búsqueda pasa la consulta por esta misma función. Español por decisión;
// una palabra en inglés sale casi igual y sigue siendo buscable.

const stemmer = newStemmer('spanish');

/** Quita etiquetas HTML y acentos, y deja solo letras y números. */
function normalize(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Texto lematizado para el índice `search_lemas`. Une los fragmentos que se
 * le pasen (título, cuerpo, ancla), descarta lo vacío y no repite raíces.
 */
export function lematizar(...parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const token of normalize(part).split(/[^a-z0-9ñ]+/)) {
      if (token.length < 2) continue;
      seen.add(stemmer.stem(token));
    }
  }
  return [...seen].join(' ');
}
