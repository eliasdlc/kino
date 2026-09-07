import { FolderKanban, GraduationCap, Rocket, Settings, Star, Target, type LucideIcon } from "lucide-react";
import { cardSurface, eyebrow } from "../styles";

const vizBox = "h-14 rounded-[10px] border border-border bg-foreground/10";

const SYSTEMS: { Icon: LucideIcon; title: string; desc: string; states: string; viz: React.ReactNode }[] = [
  {
    Icon: GraduationCap,
    title: "Académico",
    desc: "Timeline de entregas. Kino te dice cuándo empezar a estudiar.",
    states: "estudiando → borrador → entregado",
    viz: (
      <div className={`relative overflow-hidden ${vizBox}`}>
        <div className="absolute left-[8%] right-[8%] top-1/2 h-0.5 bg-foreground/10" />
        <div className="absolute left-[14%] top-[30%] h-3.5 w-[26%] rounded bg-primary/55" />
        <div className="absolute left-[46%] top-[56%] h-3.5 w-[20%] rounded bg-primary/30" />
        <div className="absolute left-[72%] top-[30%] h-3.5 w-[16%] rounded bg-foreground/10" />
      </div>
    ),
  },
  {
    Icon: FolderKanban,
    title: "Proyecto",
    desc: "Board, sprints y epics. Mueve tarjetas por su flujo sin perder tu plan del día.",
    states: "por hacer → en progreso → review → hecho",
    viz: (
      <div className={`flex gap-1.5 p-[7px] ${vizBox}`}>
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-[11px] rounded-[3px] bg-foreground/10" />
          <div className="h-[11px] rounded-[3px] bg-foreground/10" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-[11px] rounded-[3px] bg-primary/55" />
          <div className="h-[11px] rounded-[3px] bg-primary/30" />
          <div className="h-[11px] rounded-[3px] bg-foreground/10" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-[11px] rounded-[3px] bg-task-done/40" />
        </div>
      </div>
    ),
  },
  {
    Icon: Rocket,
    title: "Emprendedor",
    desc: "Milestones con KPIs e hipótesis. Mide tu velocidad real.",
    states: "validando → construyendo → lanzado",
    viz: (
      <div className={`flex flex-col justify-center gap-2 p-2.5 ${vizBox}`}>
        <MilestoneRow pct={80} color="color-mix(in srgb, var(--ac) 70%, transparent)" label="var(--ac)" />
        <MilestoneRow pct={35} color="color-mix(in srgb, var(--ac) 40%, transparent)" label="var(--mute)" />
      </div>
    ),
  },
  {
    Icon: Star,
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
    Icon: Settings,
    title: "Custom",
    desc: "Tus estados, tus campos, tu vista. Tu sistema, tus reglas.",
    states: "defínelo todo tú",
    viz: (
      <div className={`flex flex-col justify-center gap-2 px-3 py-2.5 ${vizBox}`}>
        <div className="relative h-[3px] flex-1 rounded-full bg-foreground/10">
          <span className="absolute left-[65%] top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        </div>
        <div className="flex gap-1.5">
          <span className="h-3 flex-1 rounded bg-primary/35" />
          <span className="h-3 flex-1 rounded bg-foreground/10" />
          <span className="h-3 flex-1 rounded bg-foreground/10" />
        </div>
      </div>
    ),
  },
];

export function LandingSystems() {
  return (
    <section id="sistemas" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-[1120px] px-6 py-[88px]">
        <p className={`mb-3.5 ${eyebrow}`}>Sistemas</p>
        <h2 className="mb-4 font-display text-[clamp(30px,4vw,44px)] font-bold tracking-[-0.025em] text-foreground">
          Cada área de tu vida, su propia app
        </h2>
        <p className="mb-12 max-w-[600px] text-[17px] text-muted-foreground">
          Tu tesis no se organiza como tu trabajo, ni tu trabajo como tu startup. Cada sistema
          tiene su vista, sus estados y su lógica, compartiendo una sola energía: la tuya.
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
          {SYSTEMS.map((s) => (
            <div key={s.title} className={`${cardSurface} flex flex-col gap-3 p-[22px]`}>
              <div className="flex items-center gap-2.5">
                <s.Icon className="size-[22px] text-primary" aria-hidden />
                <h3 className="font-display text-[17px] font-bold text-foreground">{s.title}</h3>
              </div>
              {s.viz}
              <p className="flex-1 text-[13.5px] text-muted-foreground">{s.desc}</p>
              <p className="font-jetbrains text-[10.5px] text-muted-foreground">{s.states}</p>
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
      <Target className="size-2.5 text-muted-foreground" aria-hidden />
      <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-foreground/10">
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
          borderColor: done ? "var(--ok)" : "color-mix(in srgb, var(--ink) 25%, transparent)",
          background: done ? "var(--ok)" : "transparent",
        }}
      />
      <div
        className="h-[7px] flex-1 rounded-full"
        style={{ background: done ? "color-mix(in srgb, var(--ink) 12%, transparent)" : "color-mix(in srgb, var(--ink) 8%, transparent)" }}
      />
    </div>
  );
}
