import { KinoMark } from "../KinoMark";

/**
 * Prueba visual del hero de cada landing por segmento: una maqueta estática de
 * cómo se ve *su* sistema en Kino. No son componentes de producción: son la
 * promesa dibujada, con el vocabulario del arquetipo (clase/obra/tarjeta) para
 * que el segmento se reconozca antes de leer una línea de copy.
 */

const card =
  "overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.55)]";

export function SegmentHeroViz({ slug }: { slug: string }) {
  if (slug === "escritores") return <WriterViz />;
  if (slug === "builders") return <BuilderViz />;
  return <StudentViz />;
}

function VizHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 pb-3.5 pt-[18px]">
      <p className="font-display text-[17px] font-bold text-foreground">{title}</p>
      <span className="font-jetbrains text-[11px] text-muted-foreground">{meta}</span>
    </div>
  );
}

function AdvisorLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-5 mb-[18px] mt-3.5 flex items-start gap-2.5 rounded-[14px] border border-primary/[0.18] bg-primary/[0.08] px-3.5 py-3">
      <span className="mt-px flex-none">
        <KinoMark size={22} withWordmark={false} />
      </span>
      <p className="text-[13px] leading-[1.5] text-primary">{children}</p>
    </div>
  );
}

/* ── Estudiantes: el semestre en una línea de tiempo ─────────────────── */

const CLASSES = [
  { name: "Cálculo II", kind: "Entrega", due: "en 2 días", accent: "var(--warn)", pct: 100 },
  { name: "Historia del arte", kind: "Lectura", due: "esta semana", accent: "var(--ac)", pct: 62 },
  { name: "Programación I", kind: "Examen", due: "en 9 días", accent: "var(--mute)", pct: 28 },
];

function StudentViz() {
  return (
    <div className={card}>
      <VizHeader title="Semestre actual" meta="3 clases" />
      <div className="flex flex-col gap-2.5 px-5 py-4">
        {CLASSES.map((c) => (
          <div
            key={c.name}
            className="rounded-[12px] border border-border bg-foreground/10 px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-[7px] w-[7px] flex-none rounded-full"
                style={{ background: c.accent }}
              />
              <span className="flex-1 truncate text-[13.5px] font-medium text-foreground/85">
                {c.name}
              </span>
              <span className="font-jetbrains text-[10px] text-muted-foreground">{c.due}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded border border-border px-1.5 py-px font-jetbrains text-[9.5px] uppercase tracking-wide text-muted-foreground">
                {c.kind}
              </span>
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${c.pct}%`, background: `${c.accent}88` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <AdvisorLine>
        La entrega de Cálculo II vence en 2 días. Tu pico es a las 10h: empieza el borrador ahí,
        no esta noche.
      </AdvisorLine>
    </div>
  );
}

/* ── Escritores: la obra, su codex y la sesión que se cuenta sola ─────── */

const CODEX = ["Elena Bravo", "Puerto Sombra", "El faro"];

function WriterViz() {
  return (
    <div className={card}>
      <VizHeader title="La casa del faro" meta="novela" />
      <div className="px-5 py-4">
        <div className="rounded-[12px] border border-border bg-foreground/10 px-3.5 py-3">
          <p className="font-jetbrains text-[10px] uppercase tracking-wide text-muted-foreground">
            Manuscrito abierto
          </p>
          <p className="mt-1 text-[14px] font-medium text-foreground/85">Capítulo 4 · La marea baja</p>
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full w-[34%] rounded-full bg-primary/70" />
            </div>
            <span className="font-jetbrains text-[10px] text-muted-foreground">17.2k / 50k</span>
          </div>
        </div>

        <p className="mb-2 mt-4 font-jetbrains text-[10px] uppercase tracking-wide text-muted-foreground">
          Codex · pineado mientras escribes
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CODEX.map((e) => (
            <span
              key={e}
              className="rounded-full border border-primary/25 bg-primary/[0.10] px-2.5 py-1 text-[11.5px] text-primary"
            >
              {e}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-task-done/20 bg-task-done/[0.07] px-3 py-2">
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-task-done" />
          <p className="font-jetbrains text-[11px] text-task-done">
            sesión detectada · 42 min · +680 palabras
          </p>
        </div>
      </div>
      <AdvisorLine>
        Tu mejor ventana creativa es ahora: dale a La casa del faro. La revisión del capítulo 3
        puede esperar a la tarde.
      </AdvisorLine>
    </div>
  );
}

/* ── Builders: el board de doble eje ──────────────────────────────────── */

const BOARD: {
  label: string;
  cards: { title: string; energy?: { label: string; color: string } }[];
}[] = [
  {
    label: "Por hacer",
    cards: [
      { title: "Rediseñar onboarding", energy: { label: "alta", color: "var(--ac)" } },
      { title: "Migrar cron" },
    ],
  },
  {
    label: "En progreso",
    cards: [{ title: "Auth con OAuth", energy: { label: "alta", color: "var(--ac)" } }],
  },
  {
    label: "Review",
    cards: [{ title: "Fix zona horaria", energy: { label: "baja", color: "var(--mute)" } }],
  },
];

function BuilderViz() {
  return (
    <div className={card}>
      <VizHeader title="Kino" meta="sprint 4" />
      <div className="grid grid-cols-3 gap-2 px-5 py-4">
        {BOARD.map((col) => (
          <div key={col.label} className="flex flex-col gap-1.5">
            <p className="font-jetbrains text-[9.5px] uppercase tracking-wide text-muted-foreground">
              {col.label}
            </p>
            {col.cards.map((c) => (
              <div
                key={c.title}
                className="rounded-[9px] border border-border bg-foreground/10 px-2 py-[7px]"
              >
                <p className="text-[11.5px] leading-tight text-foreground/80">{c.title}</p>
                {c.energy && (
                  <p className="mt-1 flex items-center gap-1 font-jetbrains text-[9.5px] text-muted-foreground">
                    <span
                      className="h-1 w-1 flex-none rounded-full"
                      style={{ background: c.energy.color }}
                    />
                    {c.energy.label}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mx-5 rounded-[10px] border border-border bg-foreground/10 px-3 py-2">
        <p className="font-jetbrains text-[10px] text-muted-foreground">
          columna del board <span className="text-muted-foreground">≠</span> estado de tu plan de hoy
        </p>
      </div>
      <AdvisorLine>
        Estás en tu ventana de alta energía: agarra &quot;Auth con OAuth&quot;. El fix de zona
        horaria cabe perfecto después de las 16h.
      </AdvisorLine>
    </div>
  );
}
