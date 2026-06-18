import Link from "next/link";
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

function Soon() {
  return (
    <span className="ml-2 align-middle rounded-full border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-2 py-0.5 font-jetbrains text-[10px] font-semibold uppercase tracking-wide text-[#fbbf24]">
      Pronto
    </span>
  );
}

function Section({ id, title, soon, children }: { id: string; title: string; soon?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-[76px] pt-[52px]">
      <h2 className="mb-3.5 font-display text-[28px] font-bold tracking-[-0.02em] text-[#f4f4f5]">
        {title}
        {soon && <Soon />}
      </h2>
      {children}
    </section>
  );
}

function Callout({ icon, tone = "indigo", children }: { icon: string; tone?: "indigo" | "amber"; children: React.ReactNode }) {
  const tones = {
    indigo: "border-[#6366f1]/[0.18] bg-[#6366f1]/[0.07] text-[#c7d2fe]",
    amber: "border-[#fbbf24]/20 bg-[#fbbf24]/[0.06] text-[#fcd34d]",
  };
  return (
    <div className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3.5 ${tones[tone]}`}>
      <span className="mt-px text-[15px]">{icon}</span>
      <p className="text-sm">{children}</p>
    </div>
  );
}

const card = "rounded-[14px] border border-white/[0.08] bg-[#18181c]";
const softCard = "rounded-xl border border-white/[0.07] bg-white/[0.03]";

const STEPS = [
  ["Crea tu cuenta", "Email y contraseña. Kino te preguntará tu nombre porque te va a hablar como un coach, no como una base de datos."],
  ["Haz tu primer check-in de energía", "¿Cómo estás ahora — alta, media o baja? Un toque. Hazlo unas veces al día y la curva empieza a tomar forma."],
  ["Crea tu primer sistema y añade tareas", "Elige un tipo (académico, profesional…), suelta 3-5 tareas con su energía estimada, y mira tu primer Plan de hoy."],
];

const CHRONOTYPES = [
  ["🌅", "Alondra", "Pico temprano, baja al atardecer."],
  ["☀️", "Intermedio", "Pico medio mañana, valle tras comer."],
  ["🦉", "Búho", "Arranca lento, pico por la tarde-noche."],
];

const SYSTEMS = [
  ["🎓", "Académico", "Timeline orientado a fechas de entrega. Kino calcula cuándo empezar a estudiar para no llegar tarde.", "por estudiar · estudiando · borrador · entregado"],
  ["🗂️", "Proyecto", "Board kanban con sprints, epics y categorías (bug/feature). Mueve tarjetas por su flujo sin perder tu plan del día.", "por hacer · en progreso · review · hecho"],
  ["🚀", "Emprendedor", "Milestones con KPIs e hipótesis. Mide tu velocidad real frente a tus metas.", "validando · construyendo · midiendo · lanzado"],
  ["🌟", "Personal", 'Lista flexible y amable, con tu "por qué" siempre visible. Cero presión, cero culpa.', "idea · activo · pausado · completado"],
  ["⚙️", "Custom", "¿Ninguno encaja? Define tus propios estados, campos y vista. Tu sistema, tus reglas.", "tú lo defines todo"],
];

const TIMER_MODES = [
  ["🍅 Pomodoro", "25 min foco + descanso. El clásico para arrancar."],
  ["⏱️ Estimado", "Cuenta atrás según el tiempo estimado de la tarea."],
  ["∞ Libre", "Cronómetro abierto para cuando estás en flow."],
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
          Tres pasos y estás dentro. No necesitas configurarlo todo el primer día — Kino aprende
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
        <Callout icon="💡" tone="indigo">
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
          {CHRONOTYPES.map(([emoji, name, desc]) => (
            <div key={name} className={`p-3.5 ${softCard}`}>
              <p className="mb-0.5 text-xl">{emoji}</p>
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
            <strong className="text-[#e4e4e7]">Recaps de foco</strong> <Soon />: tras cada sesión
            de timer, Kino te preguntará cómo fue tu energía para calibrar la curva contra tu
            rendimiento real.
          </li>
        </ul>
        <p className="mt-3.5 font-jetbrains text-[12.5px] text-[#6b6b74]">
          ≈ 2 semanas de uso → la predicción converge con tu realidad
        </p>
      </Section>

      <Section id="sistemas" title="Sistemas y tipos" soon>
        <p className="mb-4 text-[#c4c4ce]">
          Un <strong className="text-[#e4e4e7]">sistema</strong> es un área de tu vida. La idea es
          que cada tipo tenga su propia vista, sus estados y su lógica — pero todos comparten una
          sola energía: la tuya.
        </p>
        <div className="mt-4 flex flex-col gap-2.5">
          {SYSTEMS.map(([emoji, name, desc, states]) => (
            <div key={name} className={`flex items-start gap-3.5 p-4 ${card}`}>
              <span className="text-[22px]">{emoji}</span>
              <div>
                <p className="mb-1 font-semibold text-[#f4f4f5]">{name}</p>
                <p className="mb-1.5 text-sm text-[#a1a1aa]">{desc}</p>
                <p className="font-jetbrains text-[11px] text-[#52525b]">{states}</p>
              </div>
            </div>
          ))}
        </div>
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
        <Callout icon="🧭" tone="indigo">
          El <strong className="text-[#e0e7ff]">Advisor</strong> conecta ambos: te dice, en
          lenguaje natural, qué tarea de tu plan encaja mejor con tu energía de este momento.
        </Callout>
      </Section>

      <Section id="timer" title="Focus timer">
        <p className="mb-4 text-[#c4c4ce]">
          El timer no es solo un cronómetro: es como Kino aprende tu rendimiento real.
        </p>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
          {TIMER_MODES.map(([title, desc]) => (
            <div key={title} className={`p-4 ${softCard}`}>
              <p className="mb-1 text-[15px] font-semibold text-[#e4e4e7]">{title}</p>
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
          de IA gestione tus tareas y energía por ti. Son <strong className="text-[#e4e4e7]">~50
          herramientas</strong> (<code className="font-jetbrains text-[13px] text-[#c4c4ce]">create_task</code>,{" "}
          <code className="font-jetbrains text-[13px] text-[#c4c4ce]">get_today_plan</code>,{" "}
          <code className="font-jetbrains text-[13px] text-[#c4c4ce]">create_energy_checkin</code>,{" "}
          <code className="font-jetbrains text-[13px] text-[#c4c4ce]">suggest_next_action</code> …).
        </p>
        <p className="mb-2 text-[15px] font-semibold text-[#e4e4e7]">Instalar en 2 pasos</p>
        <ol className="mb-4 flex list-decimal flex-col gap-1.5 pl-[18px] text-[14.5px] text-[#c4c4ce]">
          <li>
            Genera tu <strong className="text-[#e4e4e7]">API key</strong> en{" "}
            <span className="font-jetbrains text-[13px] text-[#c7d2fe]">Ajustes → API</span>. Tiene
            scopes y puedes revocarla cuando quieras.
          </li>
          <li>Conecta tu cliente MCP con el comando de abajo (o configúralo a mano).</li>
        </ol>
        <pre className="overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#131316] px-5 py-[18px] font-jetbrains text-[13px] leading-[1.7] text-[#a1a1aa]">
          <span className="text-[#6b6b74]"># Opción rápida — configura tu cliente automáticamente</span>
          {"\n"}
          <span className="text-[#3ecf72]">npx</span> -y @kino-app/mcp setup
          {"\n\n"}
          <span className="text-[#6b6b74]"># O a mano en ~/.claude.json</span>
          {"\n"}
          {`"kino": {
  "command": "npx",
  "args": ["-y", "@kino-app/mcp"],
  "env": {
    "KINO_API_KEY": "sk-kino-…",
    "KINO_BASE_URL": "https://www.usekino.dev"
  }
}`}
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
