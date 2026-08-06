/**
 * Manifiesto de medium (PLAN-11 §6, Sprint W3). Mismo patrón que el manifiesto de
 * arquetipo (`system-types.ts`): la obra declara su medium al crearse y el medium
 * define estructura real, no una etiqueta — vocabulario de la unidad, bloques
 * propios que ofrece el editor, plantilla inicial y formato de export.
 *
 * Vive en `shared` porque lo leen las tres capas: el server (validación de
 * `folders.metadata` y export del workspace), el editor (extensiones y slash menu)
 * y las vistas (biblioteca de obras).
 */

export type MediumId =
  | 'novel'
  | 'manga'
  | 'comic'
  | 'webtoon'
  | 'screenplay'
  | 'serial'
  | 'other';

/**
 * Bloques propios que un medium ofrece en el slash menu. Los nodos Tiptap se
 * montan siempre en un editor de escritura (así cambiar el medium de una obra
 * nunca degrada contenido ya escrito); el manifiesto decide qué se *ofrece*.
 */
export type MediumBlockId =
  | 'sceneBreak'
  | 'mangaPage'
  | 'panel'
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue';

/** Serializador de export: prosa markdown, guion numerado o Fountain. */
export type MediumExportFormat = 'prose' | 'script' | 'screenplay';

/**
 * Cómo se lee la obra terminada (KIN-138). Es la cuarta salida del manifiesto,
 * junto al vocabulario, los bloques y el export: nada nuevo que decidir sobre qué
 * es cada medium, solo cómo se presenta cuando ya no se está escribiendo.
 *
 * - `book`: página paginada, serif, sangría y justificado — se lee como un libro.
 * - `script`: guion limpio de manga/cómic, con sus páginas y paneles numerados.
 * - `screenplay`: formato de guion audiovisual, con sus sangrías estándar.
 */
export type MediumReadingLayout = 'book' | 'script' | 'screenplay';

export interface MediumUnit {
  /** Cómo llama esta obra a cada manuscrito ("capítulo", "episodio"). */
  noun: string;
  nounPlural: string;
  /** CTA de creación, p.ej. "Nuevo capítulo". */
  newLabel: string;
}

export interface MediumManifest {
  id: MediumId;
  label: string;
  unit: MediumUnit;
  /** Bloques del slash menu propios de este medium, en orden. */
  blocks: MediumBlockId[];
  /** Guion: Tab cicla el tipo de bloque y Enter encadena el flujo (Final Draft). */
  screenplayKeys: boolean;
  /** Contenido inicial de un manuscrito nuevo (HTML de Tiptap). "" → en blanco. */
  template: string;
  placeholder: string;
  exportFormat: MediumExportFormat;
  /** Extensión del archivo exportado desde el editor. */
  exportExtension: 'md' | 'fountain';
  /** Presentación del modo lectura (KIN-138). */
  readingLayout: MediumReadingLayout;
}

const MANGA_TEMPLATE =
  '<section data-manga-page><article data-panel><p></p></article></section>';

const SCREENPLAY_TEMPLATE =
  '<p data-sp="sceneHeading">INT. LUGAR - DÍA</p><p data-sp="action"></p>';

export const MEDIUM_CONFIG: Record<MediumId, MediumManifest> = {
  novel: {
    id: 'novel',
    label: 'Novela',
    unit: { noun: 'capítulo', nounPlural: 'capítulos', newLabel: 'Nuevo capítulo' },
    blocks: ['sceneBreak'],
    screenplayKeys: false,
    template: '',
    placeholder: 'Empieza el capítulo…',
    exportFormat: 'prose',
    exportExtension: 'md',
    readingLayout: 'book',
  },
  manga: {
    id: 'manga',
    label: 'Manga',
    unit: { noun: 'capítulo', nounPlural: 'capítulos', newLabel: 'Nuevo capítulo' },
    blocks: ['mangaPage', 'panel'],
    screenplayKeys: false,
    template: MANGA_TEMPLATE,
    placeholder: 'Describe el panel…',
    exportFormat: 'script',
    exportExtension: 'md',
    readingLayout: 'script',
  },
  comic: {
    id: 'comic',
    label: 'Cómic',
    unit: { noun: 'issue', nounPlural: 'issues', newLabel: 'Nuevo issue' },
    blocks: ['mangaPage', 'panel'],
    screenplayKeys: false,
    template: MANGA_TEMPLATE,
    placeholder: 'Describe el panel…',
    exportFormat: 'script',
    exportExtension: 'md',
    readingLayout: 'script',
  },
  webtoon: {
    // Scroll vertical: sin páginas, solo beats — el panel es la unidad de dibujo.
    id: 'webtoon',
    label: 'Webtoon',
    unit: { noun: 'episodio', nounPlural: 'episodios', newLabel: 'Nuevo episodio' },
    blocks: ['panel'],
    screenplayKeys: false,
    template: '<article data-panel><p></p></article>',
    placeholder: 'Describe el panel…',
    exportFormat: 'script',
    exportExtension: 'md',
    readingLayout: 'script',
  },
  screenplay: {
    id: 'screenplay',
    label: 'Guion',
    unit: { noun: 'escena', nounPlural: 'escenas', newLabel: 'Nueva escena' },
    blocks: ['sceneHeading', 'action', 'character', 'parenthetical', 'dialogue'],
    screenplayKeys: true,
    template: SCREENPLAY_TEMPLATE,
    placeholder: 'Escribe la acción…',
    exportFormat: 'screenplay',
    exportExtension: 'fountain',
    readingLayout: 'screenplay',
  },
  serial: {
    id: 'serial',
    label: 'Serial / Blog',
    unit: { noun: 'entrega', nounPlural: 'entregas', newLabel: 'Nueva entrega' },
    blocks: [],
    screenplayKeys: false,
    template: '',
    placeholder: 'Empieza la entrega…',
    exportFormat: 'prose',
    exportExtension: 'md',
    readingLayout: 'book',
  },
  other: {
    id: 'other',
    label: 'Otro',
    unit: { noun: 'capítulo', nounPlural: 'capítulos', newLabel: 'Nuevo capítulo' },
    blocks: ['sceneBreak'],
    screenplayKeys: false,
    template: '',
    placeholder: 'Empieza a escribir…',
    exportFormat: 'prose',
    exportExtension: 'md',
    readingLayout: 'book',
  },
};

export const MEDIUM_IDS = Object.keys(MEDIUM_CONFIG) as MediumId[];

/** Opciones para el `<select>` del campo `medium` del manifiesto de arquetipo. */
export const MEDIUM_OPTIONS = MEDIUM_IDS.map((id) => ({
  value: id,
  label: MEDIUM_CONFIG[id].label,
}));

export const DEFAULT_MEDIUM: MediumId = 'novel';

/**
 * Sinónimos aceptados al normalizar. W1/W2 guardaron `medium` (y antes `kind`)
 * como texto libre en español: "novela", "cómic", "guión"… W3 lo convierte en
 * selección tipada, así que las obras viejas se leen a través de este mapa en vez
 * de migrarse — la metadata es jsonb y el valor legacy sigue siendo legible.
 */
const MEDIUM_ALIASES: Record<string, MediumId> = {
  novela: 'novel',
  novel: 'novel',
  libro: 'novel',
  manga: 'manga',
  comic: 'comic',
  comics: 'comic',
  historieta: 'comic',
  webtoon: 'webtoon',
  webcomic: 'webtoon',
  guion: 'screenplay',
  screenplay: 'screenplay',
  script: 'screenplay',
  pelicula: 'screenplay',
  serie: 'screenplay',
  serial: 'serial',
  blog: 'serial',
  newsletter: 'serial',
  otro: 'other',
  other: 'other',
};

/** Quita acentos y normaliza a minúsculas para comparar contra los alias. */
function normalizeKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Convierte un valor suelto (id, alias o texto libre viejo) en un `MediumId`. */
export function parseMediumValue(raw: unknown): MediumId | null {
  if (typeof raw !== 'string') return null;
  const key = normalizeKey(raw);
  if (!key) return null;
  return MEDIUM_ALIASES[key] ?? null;
}

/**
 * Medium efectivo de una obra a partir de su `folders.metadata`. Lee `medium` y
 * cae a `kind` (el nombre viejo del campo, pre-W1) antes de usar el default.
 */
export function resolveMedium(metadata: unknown): MediumId {
  if (typeof metadata !== 'object' || metadata === null) return DEFAULT_MEDIUM;
  const meta = metadata as Record<string, unknown>;
  return parseMediumValue(meta.medium) ?? parseMediumValue(meta.kind) ?? DEFAULT_MEDIUM;
}

export function getMedium(id: MediumId): MediumManifest {
  return MEDIUM_CONFIG[id];
}
