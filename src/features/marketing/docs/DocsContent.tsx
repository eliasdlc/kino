import Link from "next/link";
import {
  AlarmClock,
  Compass,
  Feather,
  FolderKanban,
  GraduationCap,
  Inbox,
  Infinity as InfinityIcon,
  Lightbulb,
  Moon,
  Rocket,
  Settings,
  Star,
  Sun,
  Sunrise,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { EnergyCurveViz } from "./EnergyCurveViz";
import { btnPrimary } from "../styles";

export const DOCS_NAV = [
  { label: "Primeros pasos", href: "#primeros-pasos" },
  { label: "Tu curva de energía", href: "#energia" },
  { label: "Sistemas y tipos", href: "#sistemas" },
  { label: "Plan vs. sugerencias", href: "#plan" },
  { label: "Focus timer", href: "#timer" },
  { label: "API y MCP", href: "#mcp" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-[76px] pt-[52px]">
      <h2 className="mb-3.5 font-display text-[28px] font-bold tracking-[-0.02em] text-[#f4f4f5]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Callout({ icon: Icon, tone = "indigo", children }: { icon: LucideIcon; tone?: "indigo" | "amber"; children: React.ReactNode }) {
  const tones = {
    indigo: "border-[#6366f1]/[0.18] bg-[#6366f1]/[0.07] text-[#c7d2fe]",
    amber: "border-[#fbbf24]/20 bg-[#fbbf24]/[0.06] text-[#fcd34d]",
  };
  return (
    <div className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3.5 ${tones[tone]}`}>
      <Icon className="mt-0.5 h-[17px] w-[17px] flex-none" aria-hidden />
      <p className="text-sm">{children}</p>
    </div>
  );
}

const card = "rounded-[14px] border border-white/[0.08] bg-[#18181c]";
const softCard = "rounded-xl border border-white/[0.07] bg-white/[0.03]";

const STEPS = [
  ["Crea tu cuenta", "Email y contraseña. Kino te preguntará tu nombre porque te va a hablar como un coach, no como una base de datos."],
  ["Haz tu primer check-in de energía", "¿Cómo estás ahora: alta, media o baja? Un toque. Hazlo unas veces al día y la curva empieza a tomar forma."],
  ["Crea tu primer sistema y añade tareas", "Elige un tipo (académico, profesional…), suelta 3-5 tareas con su energía estimada, y mira tu primer Plan de hoy."],
];

const CHRONOTYPES: [LucideIcon, string, string][] = [
  [Sunrise, "Alondra", "Pico temprano, baja al atardecer."],
  [Sun, "Intermedio", "Pico medio mañana, valle tras comer."],
  [Moon, "Búho", "Arranca lento, pico por la tarde-noche."],
];

/**
 * Los siete arquetipos, contados como los vive quien los usa. El orden y los
 * nombres siguen a `SYSTEM_TYPE_CONFIG` (`src/shared/lib/system-types.ts`), que
 * es quien de verdad gobierna la interfaz: si allí cambia un vocabulario o una
 * clase de tarea, esta sección deja de ser cierta y hay que actualizarla.
 */
interface Archetype {
  icon: LucideIcon;
  name: string;
  /** Para quién es, en una línea. */
  forWhom: string;
  /** Cómo llama a sus contenedores. */
  groups: string;
  /** Cómo llama a sus páginas. */
  pages: string;
  /** Clases de tarea propias; vacío cuando el arquetipo no añade ninguna. */
  taskKinds: string[];
  /** En qué momento del día lo propone el advisor. */
  agenda: string;
}

const ARCHETYPES: Archetype[] = [
  {
    icon: GraduationCap,
    name: "Académico",
    forWhom: "Para un semestre. Todo cuelga de una clase y casi todo tiene fecha.",
    groups: "clases",
    pages: "apuntes",
    taskKinds: ["Entrega", "Examen", "Lectura", "Práctica"],
    agenda: "Energía media, foco de 90 min",
  },
  {
    icon: FolderKanban,
    name: "Proyecto",
    forWhom: "Para trabajo que avanza por fases, tuyo o de un equipo.",
    groups: "sprints y epics, sin carpetas",
    pages: "docs",
    taskKinds: [],
    agenda: "Energía alta o media, foco de 25 min",
  },
  {
    icon: Rocket,
    name: "Emprendimiento",
    forWhom: "Para validar una idea: hipótesis, experimentos y lo que aprendes de cada uno.",
    groups: "milestones",
    pages: "learnings",
    taskKinds: ["Experimento", "Build", "Learning"],
    agenda: "En tu pico, foco de 25 min",
  },
  {
    icon: Star,
    name: "Personal",
    forWhom: "Para lo que sostiene todo lo demás: hábitos, recados, tu gente.",
    groups: "áreas",
    pages: "notas",
    taskKinds: ["Hábito", "Recado", "Evento"],
    agenda: "Franja baja, sin sesiones de foco",
  },
  {
    icon: Feather,
    name: "Escritura",
    forWhom: "Para una novela, un blog o un cómic. Abre en tus manuscritos, no en una lista de tareas.",
    groups: "obras, con su formato y su meta de palabras",
    pages: "manuscritos",
    taskKinds: ["Escribir", "Revisar", "Outline", "Publicar"],
    agenda: "En tu pico creativo, foco de 45 min",
  },
  {
    icon: Inbox,
    name: "Bandeja de entrada",
    forWhom: "Donde cae lo que capturas antes de decidir dónde va. No se organiza: se vacía.",
    groups: "nada, a propósito",
    pages: "notas",
    taskKinds: [],
    agenda: "Franja baja",
  },
  {
    icon: Settings,
    name: "Personalizado",
    forWhom: "Si ninguno encaja: tú pones los nombres y eliges las piezas.",
    groups: "carpetas, y las renombras tú",
    pages: "páginas",
    taskKinds: [],
    agenda: "Lo decides tú",
  },
];

const TIMER_MODES: [LucideIcon, string, string][] = [
  [Timer, "Pomodoro", "25 min foco + descanso. El clásico para arrancar."],
  [AlarmClock, "Estimado", "Cuenta atrás según el tiempo estimado de la tarea."],
  [InfinityIcon, "Libre", "Cronómetro abierto para cuando estás en flow."],
];

export function DocsContent() {
  return (
    <>
      <p className="mb-3.5 font-jetbrains text-xs font-semibold uppercase tracking-[0.14em] text-[#818cf8]">
        Documentación
      </p>
      <h1 className="mb-4 font-display text-[clamp(34px,5vw,48px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#f4f4f5]">
        Cómo funciona Kino
      </h1>
      <p className="mb-2 text-lg text-[#a1a1aa]">
        Todo lo que necesitas para pasar de &ldquo;instalé la app&rdquo; a &ldquo;Kino organiza mi
        día por mí&rdquo;. Léelo de corrido o salta a lo que te interese.
      </p>

      {/* chips de navegación (móvil) */}
      <div className="mb-2 flex flex-wrap gap-2 lg:hidden">
        {DOCS_NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="rounded-full border border-white/10 px-[11px] py-1.5 font-jetbrains text-[11.5px] text-[#a1a1aa] transition-colors hover:border-[#818cf8]/50 hover:text-[#c7d2fe]"
          >
            {n.label}
          </a>
        ))}
      </div>

      <Section id="primeros-pasos" title="Primeros pasos">
        <p className="mb-[22px] text-[#c4c4ce]">
          Tres pasos y estás dentro. No necesitas configurarlo todo el primer día: Kino aprende
          sobre la marcha.
        </p>
        <div className="flex flex-col gap-3">
          {STEPS.map(([title, desc], i) => (
            <div key={title} className={`flex gap-3.5 p-[18px] ${card}`}>
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[#818cf8]/35 bg-[#818cf8]/15 font-jetbrains text-[13px] font-semibold text-[#c7d2fe]">
                {i + 1}
              </span>
              <div>
                <p className="mb-1 font-semibold text-[#f4f4f5]">{title}</p>
                <p className="text-[14.5px] text-[#a1a1aa]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Callout icon={Lightbulb} tone="indigo">
          <strong className="text-[#e0e7ff]">Tip:</strong> instala Kino como app (PWA) desde el
          menú del navegador. Funciona offline y los check-ins son un toque desde tu pantalla de
          inicio.
        </Callout>
      </Section>

      <Section id="energia" title="Tu curva de energía">
        <p className="mb-5 text-[#c4c4ce]">
          El corazón de Kino. En vez de tratar todas tus horas igual, modela{" "}
          <strong className="font-semibold text-[#e4e4e7]">
            cuánta capacidad real tienes en cada momento del día
          </strong>
          .
        </p>
        <EnergyCurveViz />
        <h3 className="mb-2 mt-6 font-display text-[19px] font-bold text-[#f4f4f5]">Cronotipo</h3>
        <p className="mb-3.5 text-[15px] text-[#a1a1aa]">
          Kino detecta si eres más de mañana, de noche o intermedio. No te encasilla: ajusta la
          curva con tus datos reales.
        </p>
        <div className="mb-[22px] grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
          {CHRONOTYPES.map(([Icon, name, desc]) => (
            <div key={name} className={`p-3.5 ${softCard}`}>
              <Icon className="mb-1.5 h-[18px] w-[18px] text-[#a5b4fc]" aria-hidden />
              <p className="mb-0.5 text-sm font-semibold text-[#e4e4e7]">{name}</p>
              <p className="text-[12.5px] text-[#6b6b74]">{desc}</p>
            </div>
          ))}
        </div>
        <h3 className="mb-2 mt-6 font-display text-[19px] font-bold text-[#f4f4f5]">Cómo aprende</h3>
        <p className="mb-3 text-[15px] text-[#a1a1aa]">
          Dos fuentes alimentan la predicción, y mejora sola con el tiempo:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-[18px]">
          <li className="text-[14.5px] text-[#c4c4ce]">
            <strong className="text-[#e4e4e7]">Check-ins:</strong> tu reporte directo de cómo te
            sientes. Rápido, honesto, de 2 segundos.
          </li>
          <li className="text-[14.5px] text-[#c4c4ce]">
            <strong className="text-[#e4e4e7]">Recaps de foco</strong>: al terminar una sesión de
            timer, Kino te pregunta cómo fue tu energía y usa esa respuesta para calibrar la curva
            contra tu rendimiento real.
          </li>
        </ul>
        <p className="mt-3.5 font-jetbrains text-[12.5px] text-[#6b6b74]">
          ≈ 2 semanas de uso → la predicción converge con tu realidad
        </p>
      </Section>

      <Section id="sistemas" title="Sistemas y tipos">
        <p className="mb-4 text-[#c4c4ce]">
          Un <strong className="text-[#e4e4e7]">sistema</strong> es un área de tu vida: un
          semestre, una novela, un negocio. Al crearlo eliges su{" "}
          <strong className="text-[#e4e4e7]">tipo</strong>, y esa elección no es cosmética.
          Decide cómo se llaman sus cosas, qué puedes crear dentro y en qué momento del día te
          las propone Kino.
        </p>
        <p className="mb-[22px] text-[#c4c4ce]">
          Son siete. Lo único que no cambia entre ellos es la energía, porque sólo hay una: la
          tuya. Un sistema no compite con otro por tu mejor hora: el plan del día los ordena
          juntos.
        </p>

        <div className="flex flex-col gap-2.5">
          {ARCHETYPES.map((a) => (
            <div key={a.name} className={`flex items-start gap-3.5 p-4 ${card}`}>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[#818cf8]/[0.14]">
                <a.icon className="h-[18px] w-[18px] text-[#a5b4fc]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="mb-1 font-semibold text-[#f4f4f5]">{a.name}</p>
                <p className="mb-2 text-[14.5px] leading-[1.55] text-[#a1a1aa]">{a.forWhom}</p>
                <p className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-white/[0.12] px-2.5 py-0.5 font-jetbrains text-[11px] text-[#c4c4ce]">
                    agrupa por {a.groups}
                  </span>
                  {a.taskKinds.map((kind) => (
                    <span
                      key={kind}
                      className="rounded-full border border-[#818cf8]/25 bg-[#818cf8]/[0.08] px-2.5 py-0.5 font-jetbrains text-[11px] text-[#c7d2fe]"
                    >
                      {kind}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          ))}
        </div>

        <h3 className="mb-2 mt-7 font-display text-[19px] font-bold text-[#f4f4f5]">
          Qué cambia de uno a otro
        </h3>
        <p className="mb-3.5 text-[15px] text-[#a1a1aa]">
          Cada tipo guarda también sus páginas con su propio nombre, y le dice al advisor cuándo
          conviene proponerte sus tareas.
        </p>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[440px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.14]">
                <th className="py-2 pr-4 font-jetbrains text-[11px] font-semibold uppercase tracking-wide text-[#6b6b74]">
                  Tipo
                </th>
                <th className="py-2 pr-4 font-jetbrains text-[11px] font-semibold uppercase tracking-wide text-[#6b6b74]">
                  Páginas
                </th>
                <th className="py-2 font-jetbrains text-[11px] font-semibold uppercase tracking-wide text-[#6b6b74]">
                  Cuándo te lo propone
                </th>
              </tr>
            </thead>
            <tbody>
              {ARCHETYPES.map((a) => (
                <tr key={a.name} className="border-b border-white/[0.06] last:border-b-0">
                  <td className="py-2.5 pr-4 text-[14px] font-semibold text-[#e4e4e7]">{a.name}</td>
                  <td className="py-2.5 pr-4 text-[14px] text-[#a1a1aa]">{a.pages}</td>
                  <td className="py-2.5 text-[14px] text-[#a1a1aa]">{a.agenda}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Callout icon={Compass} tone="indigo">
          <strong className="text-[#e0e7ff]">Escritura es el único</strong> que pone las páginas
          por delante de las tareas: al abrirlo aterrizas en tu biblioteca de manuscritos, no en
          una lista de pendientes. El resto abre en sus tareas.
        </Callout>
      </Section>

      <Section id="plan" title="Plan de hoy vs. sugerencias">
        <p className="mb-5 text-[#c4c4ce]">
          Dos perspectivas del mismo día. Entender la diferencia es clave para no sentirte mandado
          por la app.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          <div className={`p-5 ${card}`}>
            <p className="mb-2 inline-flex items-center gap-2 font-display text-[17px] font-bold text-[#f4f4f5]">
              <span className="h-[9px] w-[9px] rounded-full bg-[#3ecf72]" />
              Plan de hoy
            </p>
            <p className="text-[14.5px] text-[#a1a1aa]">
              Tu <strong className="text-[#e4e4e7]">compromiso</strong>: lo que tú decides hacer
              hoy. Es tu lista, ordenada por tu energía prevista. Tú mandas.
            </p>
          </div>
          <div className={`p-5 ${card}`}>
            <p className="mb-2 inline-flex items-center gap-2 font-display text-[17px] font-bold text-[#f4f4f5]">
              <span className="h-[9px] w-[9px] rounded-full bg-[#818cf8]" />
              Sugerencias de Kino
            </p>
            <p className="text-[14.5px] text-[#a1a1aa]">
              La <strong className="text-[#e4e4e7]">recomendación</strong>: qué haría Kino ahora
              mismo, según la hora y tu energía. Una propuesta, no una orden.
            </p>
          </div>
        </div>
        <Callout icon={Compass} tone="indigo">
          El <strong className="text-[#e0e7ff]">Advisor</strong> conecta ambos: te dice, en
          lenguaje natural, qué tarea de tu plan encaja mejor con tu energía de este momento.
        </Callout>
      </Section>

      <Section id="timer" title="Focus timer">
        <p className="mb-4 text-[#c4c4ce]">
          El timer no es solo un cronómetro: es como Kino aprende tu rendimiento real.
        </p>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
          {TIMER_MODES.map(([Icon, title, desc]) => (
            <div key={title} className={`p-4 ${softCard}`}>
              <p className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-[#e4e4e7]">
                <Icon className="h-4 w-4 text-[#a5b4fc]" aria-hidden />
                {title}
              </p>
              <p className="text-[13px] text-[#6b6b74]">{desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[15px] text-[#a1a1aa]">
          La idea: al detener cualquier sesión, Kino te pregunta{" "}
          <strong className="text-[#e4e4e7]">cómo fue tu energía</strong>. Ese recap de un toque es
          lo que afina tu curva con el paso de los días.
        </p>
      </Section>

      <Section id="mcp" title="API y MCP">
        <p className="mb-4 text-[#c4c4ce]">
          Para usuarios avanzados: Kino expone su funcionalidad vía API y a través del{" "}
          <strong className="text-[#e4e4e7]">Model Context Protocol</strong>, para que tu asistente
          de IA gestione tus tareas y energía por ti. Son <strong className="text-[#e4e4e7]">69
          herramientas</strong> (<code className="font-jetbrains text-[13px] text-[#c4c4ce]">create_task</code>,{" "}
          <code className="font-jetbrains text-[13px] text-[#c4c4ce]">get_today_plan</code>,{" "}
          <code className="font-jetbrains text-[13px] text-[#c4c4ce]">get_energy_windows</code>,{" "}
          <code className="font-jetbrains text-[13px] text-[#c4c4ce]">propose_day_blocks</code>,{" "}
          <code className="font-jetbrains text-[13px] text-[#c4c4ce]">suggest_next_action</code> …).
        </p>
        <p className="mb-2 text-[15px] font-semibold text-[#e4e4e7]">Conectar en 2 pasos</p>
        <ol className="mb-4 flex list-decimal flex-col gap-1.5 pl-[18px] text-[14.5px] text-[#c4c4ce]">
          <li>
            Añade el conector con la URL{" "}
            <span className="font-jetbrains text-[13px] text-[#c7d2fe]">https://www.usekino.dev/api/mcp</span>.
            No hay claves que copiar: es un conector remoto.
          </li>
          <li>
            Tu cliente abre la pantalla de autorización de Kino. Entras con tu cuenta, eliges qué
            puede hacer el asistente (<strong className="text-[#e4e4e7]">leer</strong>,{" "}
            <strong className="text-[#e4e4e7]">proponer</strong> o{" "}
            <strong className="text-[#e4e4e7]">escribir</strong>) y listo. Puedes revocar el acceso
            cuando quieras desde tu cuenta.
          </li>
        </ol>
        <pre className="overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#131316] px-5 py-[18px] font-jetbrains text-[13px] leading-[1.7] text-[#a1a1aa]">
          <span className="text-[#6b6b74]"># Claude Code</span>
          {"\n"}
          <span className="text-[#3ecf72]">claude</span> mcp add --transport http kino https://www.usekino.dev/api/mcp
          {"\n\n"}
          <span className="text-[#6b6b74]"># claude.ai y Claude Desktop: Ajustes → Conectores → Añadir conector personalizado</span>
          {"\n"}
          <span className="text-[#6b6b74]"># y pega la misma URL.</span>
        </pre>
      </Section>

      <div className="mt-16 rounded-[18px] border border-[#818cf8]/25 bg-[linear-gradient(135deg,rgba(99,102,241,0.12),rgba(99,102,241,0.04))] p-[30px] text-center">
        <h3 className="mb-2 font-display text-[22px] font-bold text-[#f4f4f5]">
          ¿Listo para empezar?
        </h3>
        <p className="mb-[18px] text-[15px] text-[#a1a1aa]">
          Crea tu cuenta y haz tu primer check-in en menos de dos minutos.
        </p>
        <Link href="/register" className={`${btnPrimary} px-[26px] py-3 text-[15px]`}>
          Abrir Kino →
        </Link>
      </div>
    </>
  );
}
