import {
  AlarmClock,
  BookMarked,
  BookOpen,
  CalendarClock,
  Columns3,
  FlaskConical,
  Layers,
  LineChart,
  NotebookPen,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { getArchetype, type ArchetypeIdentity } from '@/features/onboarding/onboarding.archetypes';

/**
 * Manifiesto de las landings por arquetipo (`/para/<slug>`, D14). La estrategia de
 * adquisición de Kino es hablarle a cada segmento en su idioma en vez de vender
 * "gestión de tareas": el estudiante lee semestre y entregas, el escritor lee obra
 * y codex, el builder lee board y sprint. Todas cierran con el mismo diferenciador
 * — y además entiende tu energía.
 *
 * Esto es contenido, no código: la ruta se genera desde `LANDING_SEGMENTS` y añadir
 * un segmento es añadir una entrada, nunca un `if` por slug. El `slug` debe coincidir
 * con el `landingSlug` de su identidad en el manifiesto de onboarding — es lo que
 * hace que el CTA (`/register?para=<slug>`) desemboque en el onboarding ya
 * preseleccionado. El test del manifiesto verifica ese contrato.
 */

export interface SegmentPain {
  title: string;
  body: string;
}

export interface SegmentFeature {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Nombre real de la cosa dentro de Kino: la landing no promete lo que no existe. */
  proof: string;
}

export interface LandingSegment {
  /** Segmento de la URL: `/para/<slug>`. Igual al `landingSlug` de la identidad. */
  slug: string;
  identity: ArchetypeIdentity;
  /**
   * Cara del segmento. No se escribe aquí: se deriva del manifiesto de
   * identidad al construir la lista, para que la landing y la tarjeta del
   * onboarding muestren el mismo icono.
   */
  icon: LucideIcon;
  /** Nombre corto para el chip del nav y los enlaces cruzados. */
  navLabel: string;
  /** El sustantivo en frases: "¿No eres <audience>?". */
  audience: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  /** El acento se pinta en índigo dentro del h1. */
  headline: { lead: string; accent: string; tail: string };
  subheadline: string;
  heroCta: string;
  painsTitle: string;
  painsLead: string;
  pains: SegmentPain[];
  featuresTitle: string;
  featuresLead: string;
  features: SegmentFeature[];
  /** El diferenciador común, dicho con el vocabulario del segmento. */
  energyTitle: string;
  energyBody: string;
  closingTitle: string;
  closingBody: string;
  ctaLabel: string;
}

const SEGMENT_CONTENT: Omit<LandingSegment, 'icon'>[] = [
  {
    slug: 'estudiantes',
    identity: 'estudiante',
    navLabel: 'Estudiantes',
    audience: 'estudiante',
    metaTitle: 'Kino para estudiantes — Llega a la entrega sin la madrugada de pánico',
    metaDescription:
      'Tus clases, tus entregas y tus exámenes en una línea de tiempo que ves todos los días. Kino te dice cuándo empezar a estudiar, no solo cuándo entregar.',
    eyebrow: 'Para estudiantes',
    headline: { lead: 'Llega a la entrega', accent: 'sin la madrugada', tail: 'de pánico.' },
    subheadline:
      'Kino conoce tus clases, tus entregas y tus exámenes — y cada mañana te dice qué toca antes de que la fecha te alcance.',
    heroCta: 'Montar mi semestre →',
    painsTitle: 'El semestre no falla por falta de ganas',
    painsLead: 'Falla porque las fechas viven en un PDF y tu energía no aparece en ningún plan.',
    pains: [
      {
        title: 'El syllabus tiene catorce fechas. Tu cabeza, ninguna.',
        body: 'Las entregas existen en un archivo que abriste el primer día y no volviste a mirar. Hasta que faltan dos días.',
      },
      {
        title: 'Estudias cuando sobra tiempo, no cuando rindes.',
        body: 'A las once de la noche, con la batería en rojo, leyendo el mismo párrafo cuatro veces. El material era difícil; la hora, peor.',
      },
      {
        title: 'Cinco clases compitiendo por la misma cabeza.',
        body: 'Una lista única las mezcla todas y la más ruidosa gana — casi nunca la más urgente.',
      },
    ],
    featuresTitle: 'Un sistema que habla de clases, no de proyectos',
    featuresLead:
      'El sistema Académico trae el vocabulario puesto: clases, entregas, exámenes, lecturas y apuntes.',
    features: [
      {
        icon: BookOpen,
        title: 'Una clase, su propio espacio',
        body: 'Cada clase guarda su profesor, su horario y su semestre. Sus entregas y sus apuntes viven dentro, sin mezclarse con las demás.',
        proof: 'Académico · clase con profesor, horario y semestre',
      },
      {
        icon: CalendarClock,
        title: 'El semestre en una línea de tiempo',
        body: 'La vista del sistema es un timeline: ves la entrega de la semana que viene y el examen del mes que viene en el mismo golpe de vista.',
        proof: 'vista timeline · entregas y exámenes',
      },
      {
        icon: AlarmClock,
        title: 'Las tareas saben qué son',
        body: 'Una entrega no se planifica como una lectura ni como un examen. Kino distingue el tipo y lo usa para decidir cuándo ponértelo delante.',
        proof: 'Entrega · Examen · Lectura · Práctica',
      },
      {
        icon: NotebookPen,
        title: 'Los apuntes, donde pasa la clase',
        body: 'Cada clase tiene sus apuntes dentro del mismo espacio, con el editor completo: tablas, imágenes y todo lo que anotes en vivo.',
        proof: 'apuntes por clase',
      },
    ],
    energyTitle: 'Y además entiende tu energía',
    energyBody:
      'Kino aprende a qué hora rindes de verdad y reparte el semestre según esa curva: la lectura densa y el estudio para el examen caen en tu pico, y ordenar apuntes o pasar el syllabus a limpio en tu valle. Sus bloques de foco son de noventa minutos, el tamaño real de una sesión de estudio.',
    closingTitle: 'Tu semestre ya tiene un plan.',
    closingBody:
      'Empieza diciendo qué clases llevas. En dos minutos tu semestre está montado: cada clase con su primera entrega y el syllabus esperándote en el plan de hoy.',
    ctaLabel: 'Montar mi semestre gratis →',
  },
  {
    slug: 'escritores',
    identity: 'escritor',
    navLabel: 'Escritores',
    audience: 'escritor',
    metaTitle: 'Kino para escritores — Escribe en tu mejor ventana creativa',
    metaDescription:
      'Tu obra declara su forma y el editor se monta para ella. Codex de personajes, sesiones que se cuentan solas y el pico creativo del día reservado para escribir.',
    eyebrow: 'Para escritores',
    headline: { lead: 'Escribe en tu', accent: 'mejor ventana', tail: 'creativa.' },
    subheadline:
      'Kino conoce tu obra, su forma y su gente. Te reserva el pico creativo del día — y cuenta las palabras que escribiste sin que se lo pidas.',
    heroCta: 'Abrir mi obra →',
    painsTitle: 'Escribir no compite de igual a igual',
    painsLead:
      'Compite contra todo lo demás, y todo lo demás tiene fecha. Por eso queda para "cuando tenga cabeza".',
    pains: [
      {
        title: 'La cabeza se va en lo urgente.',
        body: 'Cuando por fin te sientas, ya gastaste la parte del día en la que se te ocurrían cosas.',
      },
      {
        title: 'Tu app de notas no sabe qué estás escribiendo.',
        body: 'Una novela no se escribe como un guión, ni un webtoon como un serial. El mismo documento en blanco para todo no ayuda a ninguno.',
      },
      {
        title: 'Los personajes viven en tu cabeza y en cuatro archivos.',
        body: 'El nombre del pueblo, el color de ojos, quién sabía qué en el capítulo seis. Todo a mano, todo lejos del texto.',
      },
    ],
    featuresTitle: 'El sistema que más producto real tiene detrás',
    featuresLead:
      'La escritura no es un tipo de tarea en Kino: es un sistema con su editor, su codex y su propia forma de medir el avance.',
    features: [
      {
        icon: BookMarked,
        title: 'Tu obra declara su forma',
        body: 'Novela, manga, cómic, webtoon, guión o serial. El medium que elijas gobierna los bloques del editor, la plantilla del primer manuscrito, los atajos y el formato de export.',
        proof: 'Medium · bloques, plantilla y export propios',
      },
      {
        icon: Users,
        title: 'El codex de tu historia',
        body: 'Personajes, lugares y objetos como entidades de verdad: se enlazan desde el texto, se relacionan entre sí y las que estás usando se quedan pineadas al lado mientras escribes.',
        proof: 'Codex · entidades enlazadas y referencias pineadas',
      },
      {
        icon: Timer,
        title: 'La sesión se cuenta sola',
        body: 'No hay que arrancar ningún cronómetro. Al guardar, Kino detecta que hubo una sesión de escritura, cuánto duró y cuántas palabras dejó.',
        proof: 'sesiones detectadas al guardar',
      },
      {
        icon: LineChart,
        title: 'La racha se gana escribiendo',
        body: 'El progreso sale del texto, no de un contador que marcas a mano: meta de palabras, hitos derivados sobre tu línea base y el diario de cómo creció la obra.',
        proof: 'meta de palabras · hitos · historia de la obra',
      },
    ],
    energyTitle: 'Y además entiende tu energía',
    energyBody:
      'De todos los sistemas de Kino, el de escritura es el único que pide el pico: la página nueva se agenda en tu mejor ventana creativa y la revisión cae donde la energía ya no da para inventar. Si la obra lleva días sin una sesión, Kino te lo dice cuando estás en pico — no cuando estás fundido.',
    closingTitle: 'Tu obra empieza a existir hoy.',
    closingBody:
      'Dinos qué estás escribiendo y en qué forma. Sales con la obra creada, su primer manuscrito abierto en la plantilla de su medium y la primera sesión de escritura en el plan de hoy.',
    ctaLabel: 'Abrir mi obra gratis →',
  },
  {
    slug: 'builders',
    identity: 'builder',
    navLabel: 'Builders',
    audience: 'builder',
    metaTitle: 'Kino para builders — Envía cosas terminadas, no ramas a medias',
    metaDescription:
      'Board de doble eje, sprints y epics para tu proyecto. Y un plan diario que sabe cuál de esas tarjetas puedes de verdad con la energía que te queda hoy.',
    eyebrow: 'Para builders',
    headline: { lead: 'Envía cosas', accent: 'terminadas', tail: '— no ramas a medias.' },
    subheadline:
      'Board, sprints y epics para el proyecto. Y un plan diario que sabe cuál de esas tarjetas puedes de verdad con la energía que te queda hoy.',
    heroCta: 'Montar mi board →',
    painsTitle: 'El board te dice dónde está la tarjeta',
    painsLead: 'Nunca si hoy puedes con ella. Esa es la pregunta que decide si el proyecto avanza.',
    pains: [
      {
        title: 'El sprint lo planeó el "tú" de los lunes.',
        body: 'Optimista, descansado y con toda la tarde libre. El jueves paga la factura.',
      },
      {
        title: 'Refactor y triage de bugs no cuestan lo mismo.',
        body: 'Pero en una lista plana pesan igual, así que terminas haciendo lo barato y dejando lo profundo para "mañana temprano".',
      },
      {
        title: 'El side project solo avanza cuando sobra energía.',
        body: 'Y nunca sobra. Se queda dormido semanas y te enteras cuando ya te da culpa abrirlo.',
      },
    ],
    featuresTitle: 'Un board que no le miente a tu día',
    featuresLead:
      'El sistema Proyecto trae el flujo completo, y separa lo que casi todas las herramientas confunden.',
    features: [
      {
        icon: Columns3,
        title: 'Board de doble eje',
        body: 'La columna del board y el estado de tu plan diario son cosas distintas. Mover una tarjeta a "En progreso" ordena el proyecto sin mentirle a lo que de verdad estás haciendo hoy.',
        proof: 'Por hacer → En progreso → En review → Hecho',
      },
      {
        icon: Layers,
        title: 'Sprints, epics y categorías',
        body: 'Agrupa por ciclo, por objetivo grande o por área. El board es la vista por defecto del sistema, no un extra que hay que configurar.',
        proof: 'vista kanban · sprints · epics · categorías',
      },
      {
        icon: Timer,
        title: 'Pomodoros de veinticinco',
        body: 'El foco entra en bloques del tamaño real de una tarjeta, con recap de energía al terminar: cada sesión calibra la curva que arma el plan de mañana.',
        proof: 'Focus timer · 25 min con recap',
      },
      {
        icon: FlaskConical,
        title: 'Kino reclama el proyecto dormido',
        body: 'Cuando el proyecto lleva días sin actividad, Kino te lo pone delante justo en tu ventana de alta energía, que es la única hora en la que ese aviso sirve de algo.',
        proof: 'aviso de sistema estancado en tu pico',
      },
    ],
    energyTitle: 'Y además entiende tu energía',
    energyBody:
      'Kino aprende tu curva real y ordena el board según ella: la feature que exige cabeza entra en tu pico, el triage de bugs y la actualización del changelog en el valle. El plan del día sale corto y accionable — entre tres y siete tarjetas, no el backlog entero.',
    closingTitle: 'Tu board arranca con trabajo real.',
    closingBody:
      'Escribe lo que estás construyendo ahora mismo y entra como tarjetas en "Por hacer" — más la única pregunta que ordena un proyecto de verdad: qué significa "terminado" en este.',
    ctaLabel: 'Montar mi board gratis →',
  },
];

export const LANDING_SEGMENTS: LandingSegment[] = SEGMENT_CONTENT.map((segment) => ({
  ...segment,
  icon: getArchetype(segment.identity).icon,
}));

export const SEGMENT_SLUGS = LANDING_SEGMENTS.map((s) => s.slug);

export function getSegment(slug: string): LandingSegment | null {
  return LANDING_SEGMENTS.find((s) => s.slug === slug) ?? null;
}

/** Los otros segmentos, para el bloque "¿no eres <audience>?" al pie de cada landing. */
export function otherSegments(slug: string): LandingSegment[] {
  return LANDING_SEGMENTS.filter((s) => s.slug !== slug);
}

/**
 * Destino del CTA. Lleva el slug hasta el registro para que el onboarding
 * continúe la misma conversación en vez de volver a preguntar quién eres.
 */
export function segmentRegisterHref(segment: LandingSegment): string {
  return `/register?para=${segment.slug}`;
}

