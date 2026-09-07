"use client";

import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";

const SCALE: Array<{ cls: string; px: string; usage: string }> = [
  { cls: "text-3xl font-bold", px: "30px", usage: "Título de página (marketing, onboarding)" },
  { cls: "text-2xl font-semibold", px: "24px", usage: "Título de sección / h1 del editor" },
  { cls: "text-xl font-semibold", px: "20px", usage: "Encabezado de dialog / h2 del editor" },
  { cls: "text-lg font-semibold", px: "18px", usage: "Título de card destacada / h3 del editor" },
  { cls: "text-base", px: "16px", usage: "Cuerpo base (body)" },
  { cls: "text-sm", px: "14px", usage: "UI general: botones, inputs, listas" },
  { cls: "text-xs", px: "12px", usage: "Metadatos, badges, etiquetas" },
  { cls: "text-[11px]", px: "11px", usage: "Micro-metadatos (contador de tareas en cards)" },
];

export function TypographySection() {
  return (
    <Section
      id="tipografia"
      number="02"
      title="Tipografía"
      description="Dos caras y una mono, cargadas una sola vez para la app y el marketing: Bricolage Grotesque sólo para la cifra y los títulos de pantalla, Inter para todo lo demás (botones, chips, pestañas y etiquetas nunca llevan la display), JetBrains Mono para datos y código. Literata queda como serif de lectura del arquetipo Writing."
    >
      <SubSection title="Familias">
        <SpecimenGrid cols={3}>
          <Specimen label="Bricolage Grotesque" hint="font-display · la cifra del día y los títulos de pantalla">
            <div className="font-display">
              <p className="text-5xl font-bold tracking-tight text-primary">52</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">Trabaja con tu energía</p>
            </div>
          </Specimen>
          <Specimen label="Inter" hint="font-sans · --font-sans · toda la UI">
            <div>
              <p className="text-2xl">Aa Bb Cc 0123</p>
              <p className="mt-1 text-sm text-muted-foreground">
                La rápida gestión de energía diaria.
              </p>
            </div>
          </Specimen>
          <Specimen label="Literata" hint="font-serif · --font-literata · leer y escribir prosa">
            <div className="font-serif">
              <p className="text-2xl">Aa Bb Cc 0123</p>
              <p className="mt-1 text-sm text-muted-foreground">
                La rápida gestión de energía diaria.
              </p>
            </div>
          </Specimen>
          <Specimen label="JetBrains Mono" hint="font-mono · --font-mono · código, kbd, datos">
            <div className="font-mono">
              <p className="text-2xl">Aa Bb Cc 0123</p>
              <p className="mt-1 text-sm text-muted-foreground">
                const energy = &quot;high&quot;;
              </p>
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Escala"
        description="Escala Tailwind por defecto. La UI vive casi entera entre text-sm y text-xs; los tamaños grandes son para títulos y el editor."
      >
        <div className="divide-y divide-border rounded-lg border border-border">
          {SCALE.map((s) => (
            <div key={s.cls} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 p-4">
              <span className={`${s.cls} min-w-0`}>Gestión de energía</span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                {s.cls} · {s.px}
              </span>
              <span className="w-full text-xs text-muted-foreground sm:w-auto sm:shrink-0">
                {s.usage}
              </span>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection
        title="Prosa de escritor (arquetipo Writing)"
        description="El editor Writing usa Literata ~17px, line-height 1.85, párrafos justificados con sangría tipo libro (.tiptap-writer en globals.css). Esta muestra replica esos valores."
      >
        <div
          className="max-w-xl rounded-lg border border-border bg-card p-6 font-serif"
          style={{ fontSize: "1.0625rem", lineHeight: 1.85, letterSpacing: "0.003em" }}
        >
          <p style={{ textAlign: "justify" }}>
            La casa dormía cuando ella bajó a la cocina. El reloj del pasillo marcaba una
            hora imposible y, sin embargo, la luz que entraba por la ventana tenía la
            paciencia exacta del amanecer.
          </p>
          <p style={{ textAlign: "justify", textIndent: "1.4em" }}>
            Escribió la primera frase dos veces. La segunda versión era peor, así que
            recuperó la primera y siguió adelante, que es lo único que un borrador pide.
          </p>
        </div>
        <div
          className="mt-4 max-w-xl rounded-lg p-6 font-serif"
          style={{
            fontSize: "1.0625rem",
            lineHeight: 1.85,
            background: "#f6f1e7",
            color: "#2b2620",
          }}
        >
          <p style={{ textAlign: "justify" }}>
            Variante «papel» (data-paper=&quot;on&quot;): fondo cálido #f6f1e7 con tinta #2b2620,
            activable por columna del editor sin tocar el resto de la app.
          </p>
        </div>
      </SubSection>

      <SubSection
        title="Prosa del editor de páginas (Tiptap)"
        description="Estilos .tiptap-editor de globals.css: jerarquía de headings, listas, quote y código."
      >
        <div className="max-w-xl rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold leading-tight">Título H1</h1>
          <h2 className="mt-5 text-xl font-semibold leading-tight">Sección H2</h2>
          <p className="mt-1 leading-7">
            Párrafo con <strong className="font-semibold">negrita</strong>,{" "}
            <em className="italic">cursiva</em> y{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">código inline</code>.
          </p>
          <blockquote className="my-3 border-l-4 border-border pl-4 italic text-muted-foreground">
            Una cita destacada dentro del documento.
          </blockquote>
          <ul className="my-2 list-disc space-y-1 pl-6">
            <li className="leading-7">Elemento de lista</li>
            <li className="leading-7">Otro elemento</li>
          </ul>
        </div>
      </SubSection>
    </Section>
  );
}
