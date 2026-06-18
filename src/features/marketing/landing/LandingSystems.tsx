import { cardSurface, eyebrow } from "../styles";

const vizBox = "h-14 rounded-[10px] border border-white/[0.06] bg-white/[0.03]";

const SYSTEMS: { emoji: string; title: string; desc: string; states: string; viz: React.ReactNode }[] = [
  {
    emoji: "🎓",
    title: "Académico",
    desc: "Timeline de entregas. Kino te dice cuándo empezar a estudiar.",
    states: "estudiando → borrador → entregado",
    viz: (
      <div className={`relative overflow-hidden ${vizBox}`}>
        <div className="absolute left-[8%] right-[8%] top-1/2 h-0.5 bg-white/10" />
        <div className="absolute left-[14%] top-[30%] h-3.5 w-[26%] rounded bg-[#818cf8]/55" />
        <div className="absolute left-[46%] top-[56%] h-3.5 w-[20%] rounded bg-[#818cf8]/30" />
        <div className="absolute left-[72%] top-[30%] h-3.5 w-[16%] rounded bg-white/[0.14]" />
      </div>
    ),
  },
  {
    emoji: "🗂️",
    title: "Proyecto",
    desc: "Board, sprints y epics. Mueve tarjetas por su flujo sin perder tu plan del día.",
    states: "por hacer → en progreso → review → hecho",
    viz: (
      <div className={`flex gap-1.5 p-[7px] ${vizBox}`}>
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-[11px] rounded-[3px] bg-white/[0.14]" />
          <div className="h-[11px] rounded-[3px] bg-white/[0.09]" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-[11px] rounded-[3px] bg-[#818cf8]/55" />
          <div className="h-[11px] rounded-[3px] bg-[#818cf8]/30" />
          <div className="h-[11px] rounded-[3px] bg-white/[0.09]" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-[11px] rounded-[3px] bg-[#3ecf72]/40" />
        </div>
      </div>
    ),
  },
  {
    emoji: "🚀",
    title: "Emprendedor",
    desc: "Milestones con KPIs e hipótesis. Mide tu velocidad real.",
    states: "validando → construyendo → lanzado",
    viz: (
      <div className={`flex flex-col justify-center gap-2 p-2.5 ${vizBox}`}>
        <MilestoneRow pct={80} color="rgba(129,140,248,0.7)" label="#818cf8" />
        <MilestoneRow pct={35} color="rgba(129,140,248,0.4)" label="#6b6b74" />
      </div>
    ),
  },
  {
    emoji: "🌟",
    title: "Personal",
    desc: 'Lista flexible con tu "por qué" siempre visible. Sin presión.',
    states: "idea → activo → pausado → completado",
    viz: (
      <div className={`flex flex-col justify-center gap-1.5 p-2.5 ${vizBox}`}>
        <PersonalRow done />
        <PersonalRow />
        <PersonalRow />
      </div>
    ),
  },
  {
    emoji: "⚙️",
    title: "Custom",
    desc: "Tus estados, tus campos, tu vista. Tu sistema, tus reglas.",
    states: "defínelo todo tú",
    viz: (
      <div className={`flex flex-col justify-center gap-2 px-3 py-2.5 ${vizBox}`}>
        <div className="relative h-[3px] flex-1 rounded-full bg-white/[0.12]">
          <span className="absolute left-[65%] top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#818cf8]" />
        </div>
        <div className="flex gap-1.5">
          <span className="h-3 flex-1 rounded bg-[#818cf8]/35" />
          <span className="h-3 flex-1 rounded bg-white/10" />
          <span className="h-3 flex-1 rounded bg-white/10" />
        </div>
      </div>
    ),
  },
];

export function LandingSystems() {
  return (
    <section id="sistemas" className="scroll-mt-20 border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1120px] px-6 py-[88px]">
        <p className={`mb-3.5 ${eyebrow}`}>Sistemas</p>
        <h2 className="mb-4 font-display text-[clamp(30px,4vw,44px)] font-bold tracking-[-0.025em] text-[#f4f4f5]">
          Cada área de tu vida, su propia app
        </h2>
        <p className="mb-12 max-w-[600px] text-[17px] text-[#a1a1aa]">
          Tu tesis no se organiza como tu trabajo, ni tu trabajo como tu startup. Cada sistema
          tiene su vista, sus estados y su lógica — compartiendo una sola energía: la tuya.
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
          {SYSTEMS.map((s) => (
            <div key={s.title} className={`${cardSurface} flex flex-col gap-3 p-[22px]`}>
              <div className="flex items-center gap-2.5">
                <span className="text-[22px]">{s.emoji}</span>
                <h3 className="font-display text-[17px] font-bold text-[#f4f4f5]">{s.title}</h3>
              </div>
              {s.viz}
              <p className="flex-1 text-[13.5px] text-[#a1a1aa]">{s.desc}</p>
              <p className="font-jetbrains text-[10.5px] text-[#52525b]">{s.states}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MilestoneRow({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-[7px]">
      <span className="text-[10px]">🎯</span>
      <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-jetbrains text-[9px]" style={{ color: label }}>
        {pct}%
      </span>
    </div>
  );
}

function PersonalRow({ done = false }: { done?: boolean }) {
  return (
    <div className="flex items-center gap-[7px]">
      <span
        className="h-[11px] w-[11px] flex-none rounded-full border-[1.5px]"
        style={{
          borderColor: done ? "#3ecf72" : "rgba(255,255,255,0.25)",
          background: done ? "#3ecf72" : "transparent",
        }}
      />
      <div
        className="h-[7px] flex-1 rounded-full"
        style={{ background: done ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)" }}
      />
    </div>
  );
}
