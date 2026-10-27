"use client";

import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";

const SCALE: Array<{ cls: string; usage: string; sample?: string }> = [
  { cls: "font-display text-[4.4rem] font-extrabold leading-[.86] tracking-[-.04em] text-primary tabular-nums", usage: "La cota: Bricolage 800, 4.4rem, en el acento", sample: "64" },
  { cls: "font-display text-[1.9rem] font-bold leading-[1.02] tracking-[-.025em]", usage: "Título de pantalla: Bricolage 700, 1.9rem" },
  { cls: "font-display text-xl font-bold leading-tight tracking-tight", usage: "Encabezado de sección y título de overlay: Bricolage 700, 1.25rem" },
  { cls: "font-display text-[1.55rem] font-bold tabular-nums", usage: "Cifra de lectura (palabras hoy, días sin sesión): Bricolage 700" },
  { cls: "font-heading text-lg font-bold tracking-[-.01em]", usage: "Subhead: Figtree 700" },
  { cls: "text-base", usage: "Cuerpo: Figtree 400, 17 px" },
  { cls: "text-base font-semibold", usage: "Nombre de una fila: Figtree 600" },
  { cls: "text-sm", usage: "UI: botones, pastillas, valores de ajustes" },
  { cls: "text-sm text-muted-foreground", usage: "Meta de una fila" },
  { cls: "text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground", usage: "Eyebrow: Figtree 600, mayúsculas, +0.06em, una por región" },
];

export function TypographySection() {
  return (
    <Section
      id="tipografia"
      number="02"
      title="Tipografía"
      description="Tres caras y una mono, cargadas una sola vez en el layout raíz. Bricolage Grotesque es la display: 800 en la cota, 700 en los títulos y las cifras. Figtree es la interfaz: botones, pastillas, pestañas, etiquetas y texto corrido. Literata es la prosa del escritor y también la voz: la frase de la cota, la intención de un sistema, el título de un manuscrito. En cursiva lo que es voz, en redonda lo que es texto. JetBrains Mono para datos y código, sin precarga."
    >
      <SubSection title="Familias">
        <SpecimenGrid cols={2}>
          <Specimen label="Bricolage Grotesque" hint="font-display, --font-bricolage: la cota, los títulos, las cifras">
            <div className="font-display">
              <p className="text-[4.4rem] font-extrabold leading-[.86] tracking-[-.04em] text-primary tabular-nums">64</p>
              <p className="mt-2 text-[1.9rem] font-bold leading-[1.02] tracking-[-.025em]">La casa de las cotas</p>
            </div>
          </Specimen>
          <Specimen label="Figtree" hint="font-sans, --font-figtree: toda la interfaz">
            <div>
              <p className="text-2xl font-semibold">Aa Bb Cc 0123</p>
              <p className="mt-1 text-base">Parcial de Cálculo III</p>
              <p className="text-sm text-muted-foreground">vencida 8 sept, crítica, Semestre actual</p>
            </div>
          </Specimen>
          <Specimen label="Literata, voz" hint="font-voice italic, --font-literata: la frase de la cota, la intención, el vacío">
            <div className="font-voice italic text-body">
              <p className="text-2xl">Aa Bb Cc 0123</p>
              <p className="mt-1 text-base">Mejor para tareas de enfoque medio.</p>
            </div>
          </Specimen>
          <Specimen label="Literata, prosa" hint="font-serif, --font-literata: leer y escribir, el título de un manuscrito">
            <div className="font-serif">
              <p className="text-2xl">Aa Bb Cc 0123</p>
              <p className="mt-1 text-base">El clima que no cabe</p>
            </div>
          </Specimen>
          <Specimen label="JetBrains Mono" hint="font-mono, --font-jetbrains-mono: código, teclas, datos">
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
        description="Todo en rem sobre una raíz de 17 px, así que crece con el tamaño de letra del sistema. Tracking: -0.04em en la cota, -0.025em en el título, -0.02em en el encabezado, 0 desde el cuerpo."
      >
        <div className="divide-y divide-border rounded-xl border border-border">
          {SCALE.map((s) => (
            <div key={s.cls} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 p-4">
              <span className={`${s.cls} min-w-0`}>{s.sample ?? "Gestión de energía"}</span>
              <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto sm:shrink-0">
                {s.usage}
              </span>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection
        title="Prosa de escritor (arquetipo Writing)"
        description="El editor usa Literata a 1.0625rem, interlínea 1.85, párrafos justificados con sangría de libro (.tiptap-writer en globals.css). Esta muestra replica esos valores sobre el papel de la casa."
      >
        <div
          className="max-w-xl rounded-xl border border-border bg-card p-6 font-serif"
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
          data-paper="on"
          className="mt-4 max-w-xl rounded-xl p-6 font-serif"
          style={{ fontSize: "1.0625rem", lineHeight: 1.85 }}
        >
          <p style={{ textAlign: "justify" }}>
            El papel cálido del editor (data-paper=&quot;on&quot;): se activa por columna del
            editor y no toca el resto de la app. Se conserva de la dirección anterior.
          </p>
        </div>
      </SubSection>

      <SubSection
        title="Prosa del editor de páginas (Tiptap)"
        description="Estilos .tiptap-editor de globals.css: jerarquía de encabezados, listas, cita y código."
      >
        <div className="max-w-xl rounded-xl border border-border bg-card p-6">
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
