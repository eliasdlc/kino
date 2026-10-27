"use client";

import { useState } from "react";
import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import { Button } from "@/components/ui/button";
import { MarginRow } from "@/components/ui/margin-row";
import { Folder, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RADII: Array<{ name: string; cls: string; note: string }> = [
  { name: "rounded-full", cls: "rounded-full", note: "999: toda acción y todo estado (botón, campo, segmento, círculo)" },
  { name: "rounded-xl", cls: "rounded-xl", note: "1.125rem: lo poco que es superficie (hoja, diálogo, menú, área de texto). lg, 2xl y 3xl valen lo mismo" },
  { name: "rounded-md", cls: "rounded-md", note: "0.5rem: el resalte de una fila de menú, una tecla" },
  { name: "rounded-sm", cls: "rounded-sm", note: "0.3rem: la nota adhesiva" },
];

const MOTION: Array<{ name: string; token: string; note: string }> = [
  { name: "pluma", token: "--ease-pluma", note: "cubic-bezier(.2,.8,.2,1): entrar y asentar" },
  { name: "tinta", token: "--ease-tinta", note: "cubic-bezier(.4,0,1,1): salir" },
  { name: "toque", token: "--dur-toque", note: "120 ms: el círculo o la pastilla a scale .97" },
  { name: "tachar", token: "--dur-tachar", note: "160 ms: el círculo se rellena y el título cae a mute" },
  { name: "página", token: "--dur-pagina", note: "180 ms: pasar página, sólo la entrada" },
  { name: "hoja", token: "--dur-hoja", note: "240 ms: la hoja inferior sube y se recoge" },
  { name: "cuenta", token: "--dur-cuenta", note: "550 ms: la cuenta de la cota, ease-out cúbico en JavaScript" },
];

/**
 * Cada keyframe se dispara al tocar y corre una sola vez: la clave cambia,
 * el nodo se vuelve a montar y la animación corre desde su primer fotograma
 * (`backwards`) sin dejar ningún transform puesto al acabar.
 */
function KeyframeDemo({ label, hint, cls, children }: { label: string; hint: string; cls: string; children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  return (
    <Specimen label={label} hint={hint}>
      <div className="flex w-full flex-col items-start gap-3">
        <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)}>
          Disparar
        </Button>
        <div className="flex h-12 w-full items-center overflow-hidden">
          <div key={tick} className={tick > 0 ? cls : undefined}>
            {children}
          </div>
        </div>
      </div>
    </Specimen>
  );
}

function TacharDemo() {
  const [hecha, setHecha] = useState(false);
  return (
    <Specimen label="tachar" hint="anim-tachar en el círculo; el título transiciona color en --dur-tachar">
      <MarginRow
        className="w-full"
        margin={
          <button
            type="button"
            aria-label={hecha ? "Marcar pendiente" : "Marcar hecha"}
            aria-pressed={hecha}
            onClick={() => setHecha((h) => !h)}
            className="press flex size-[2.85rem] items-center justify-center rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma) focus-ring"
          >
            <span
              className={`block size-[1.35rem] rounded-full border-[1.6px] border-ln2 ${hecha ? "anim-tachar" : ""}`}
            />
          </button>
        }
        trailing="3 pts"
      >
        <p
          className={`text-base font-semibold transition-colors duration-(--dur-tachar) ease-(--ease-pluma) ${hecha ? "text-muted-foreground line-through decoration-ln2" : "text-foreground"}`}
        >
          Parcial de Cálculo III
        </p>
        <p className="text-sm text-muted-foreground">
          {hecha ? "hecha a las 10:12" : "vence hoy"}
        </p>
      </MarginRow>
    </Specimen>
  );
}

export function FoundationsSection() {
  return (
    <Section
      id="fundamentos"
      number="03"
      title="Radio, elevación, movimiento y margen"
      description="Diario tiene dos radios, una sola sombra, un sistema de movimiento con nombre y una columna de margen que firma toda pantalla. Todo en rem sobre una raíz de 17 px."
    >
      <SubSection
        title="Escala de radio"
        description="La pastilla en toda acción y estado; 1.125rem en lo poco que es superficie. No hay card por defecto, así que no hay radio de card."
      >
        <div className="flex flex-wrap items-end gap-6">
          {RADII.map((r) => (
            <div key={r.name} className="flex max-w-40 flex-col items-center gap-2">
              <div className={`h-20 w-32 border border-ln2 bg-muted ${r.cls}`} />
              <p className="font-mono text-[11px] text-muted-foreground">{r.name}</p>
              <p className="text-center text-[11px] text-muted-foreground">{r.note}</p>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection
        title="Elevación"
        description="Ninguna en las páginas. Una sola sombra, el token --shadow (0 .6rem 1.6rem, tinta al 8 %), sólo en claro y sólo para la hoja inferior, el diálogo y la nota adhesiva. En oscuro --shadow vale none y la elevación es un paso de tono: bg, sf, sf2. Los tres niveles van aquí sobre el mismo papel para que se comparen; en claro la diferencia es la sombra, en oscuro es el tono."
      >
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-3">
          <Specimen label="Página" hint="bg, sin hairline ni sombra">
            <div className="flex h-24 w-full items-end rounded-xl bg-background p-3 text-xs text-muted-foreground">sólo el papel</div>
          </Specimen>
          <Specimen label="Superficie" hint="sf con hairline (card, menú, popover)">
            <div className="flex h-24 w-full items-end rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">sf y hairline</div>
          </Specimen>
          <Specimen label="Hoja y diálogo" hint="sf con --shadow; en oscuro, ninguna">
            <div className="flex h-24 w-full items-end rounded-xl border border-border bg-popover p-3 text-xs text-muted-foreground shadow-(--shadow)">sf y la única sombra</div>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Movimiento con nombre"
        description="Dos curvas y cinco duraciones en globals.css. Sólo transform, opacity y color; nada en bucle; prefers-reduced-motion lo apaga todo desde el bloque global. Cada demo se dispara al tocar y corre una vez."
      >
        <div className="mb-6 divide-y divide-border rounded-xl border border-border">
          {MOTION.map((m) => (
            <div key={m.token} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5">
              <span className="w-16 text-sm font-semibold">{m.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{m.token}</span>
              <span className="text-xs text-muted-foreground">{m.note}</span>
            </div>
          ))}
        </div>
        <SpecimenGrid cols={2}>
          <KeyframeDemo label="entrar-pagina" cls="anim-entrar-pagina" hint="anim-entrar-pagina: translateX 1.5rem a 0, opacity .85 a 1, --dur-pagina, pluma">
            <div className="rounded-xl border border-border bg-card px-4 py-2 text-sm">La página nueva entra desde la derecha.</div>
          </KeyframeDemo>
          <KeyframeDemo label="subir-hoja" cls="anim-subir-hoja" hint="anim-subir-hoja: translateY 100% a 0, --dur-hoja, pluma">
            <div className="rounded-t-xl border border-border bg-popover px-4 py-2 text-sm shadow-(--shadow)">La hoja sube.</div>
          </KeyframeDemo>
          <KeyframeDemo label="recoger-hoja" cls="anim-recoger-hoja" hint="anim-recoger-hoja: translateY 0 a 100%, --dur-hoja, tinta">
            <div className="rounded-t-xl border border-border bg-popover px-4 py-2 text-sm shadow-(--shadow)">La hoja se recoge.</div>
          </KeyframeDemo>
          <TacharDemo />
        </SpecimenGrid>
        <div className="mt-4">
          <Specimen label="press" hint="scale .97 al mantener, --dur-toque; viene en Button y Segmented">
            <Button>Mantén pulsado</Button>
            <button type="button" className="press flex size-[2.85rem] items-center justify-center rounded-full bg-secondary transition-transform duration-(--dur-toque) ease-(--ease-pluma) focus-ring" aria-label="Círculo">
              <span className="block size-[1.35rem] rounded-full border-[1.6px] border-ln2" />
            </button>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="El margen: MarginRow"
        description="Una columna de 3.1rem (--margen) a la izquierda de toda página: ahí viven el glifo, el numeral, el círculo y la nota adhesiva. El texto nunca entra en el margen. MarginRow reparte margen, texto y cola en grid-cols-[var(--margen)_1fr_auto]; con href u onClick la fila entera es tocable, con foco y toque de la casa; sin ellos, lo tocable va dentro (el círculo). Un bloque que no es fila (la cota, un párrafo) se sangra con pl-(--margen). Cuándo usar: toda lista del teléfono (tareas, índice, ajustes)."
      >
        <div className="max-w-md">
          <MarginRow
            onClick={() => {}}
            margin={<span className="font-display text-lg font-bold text-primary">I</span>}
            trailing={<ChevronRight className="size-5" />}
          >
            <span className="block text-base font-semibold text-foreground">Primera parte: la subida</span>
            <span className="block text-sm text-muted-foreground">Fila tocable (onClick): Tab para ver el foco</span>
          </MarginRow>
          <MarginRow margin={<Folder className="size-5" />}>
            <p className="text-base font-medium text-foreground">Capítulos 1 a 5</p>
            <p className="text-sm text-muted-foreground">3 manuscritos, fila sin acción</p>
          </MarginRow>
          <MarginRow margin={<span className="font-display text-lg font-bold">1</span>} trailing={<span><b className="block text-sm font-semibold text-foreground">1.240</b>palabras</span>}>
            <p className="font-serif text-base text-foreground">El clima que no cabe</p>
            <p className="text-sm text-muted-foreground">ayer, con 2 notas</p>
          </MarginRow>
          <p className="mt-4 pl-(--margen) font-voice text-base italic text-body">
            Un párrafo que no es fila se alinea con la columna de texto.
          </p>
        </div>
      </SubSection>

      <SubSection
        title="Card frente a MarginRow"
        description="Cuándo usar Card: sólo en el escritorio y en el shell (un panel lateral, un bloque de ajustes de dos columnas), donde una superficie sí separa. Es superficie con hairline y sin sombra en ningún modo. Nunca para agrupar una lista en el teléfono: ahí la lista son filas de margen."
      >
        <div className="max-w-md">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Panel de escritorio</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Un bloque que en una pantalla ancha necesita su propio borde.
            </CardContent>
          </Card>
        </div>
      </SubSection>

      <SubSection
        title="Espaciado"
        description="La escala de Tailwind en múltiplos de 0.25rem. Margen de pantalla 1.25rem en el teléfono, 1.25rem entre bloques de página, 0.5rem a 0.75rem dentro de un control."
      >
        <div className="flex flex-wrap items-end gap-6">
          {[
            ["1", "0.25rem"],
            ["2", "0.5rem"],
            ["3", "0.75rem"],
            ["4", "1rem"],
            ["5", "1.25rem"],
            ["6", "1.5rem"],
            ["8", "2rem"],
            ["12", "3rem"],
          ].map(([step, rem]) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <div className="w-4 rounded-sm bg-primary/70" style={{ height: rem }} />
              <p className="font-mono text-[11px] text-muted-foreground">
                {step}, {rem}
              </p>
            </div>
          ))}
        </div>
      </SubSection>
    </Section>
  );
}
