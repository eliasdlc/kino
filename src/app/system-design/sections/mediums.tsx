"use client";

import { Section, SubSection, Specimen } from "../helpers";
import { SCREENPLAY_LABELS } from "@/features/pages/mediums/screenplay.extension";

/**
 * Los bloques por medium (PLAN-11 W3).
 *
 * A diferencia del resto del catálogo, estos no son componentes React: son nodos
 * de Tiptap que se renderizan como HTML con una clase, y todo su aspecto vive en
 * `globals.css` bajo `.tiptap-editor .ProseMirror`. Por eso el specimen reproduce
 * ese envoltorio exacto en vez de montar un editor: lo que se ve aquí sale de las
 * mismas reglas CSS que ve el autor escribiendo, y un cambio en la hoja de estilos
 * se refleja aquí sin tocar esta página.
 *
 * La numeración de páginas y paneles es de contadores CSS, no texto: insertar un
 * panel en medio renumera solo (D12, derivar antes que mantener).
 */

/** El envoltorio que activan las reglas de `globals.css`. */
function EditorSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="tiptap-editor w-full">
      <div className="ProseMirror">{children}</div>
    </div>
  );
}

const SCREENPLAY_LINES: Array<{ node: keyof typeof SCREENPLAY_LABELS; text: string }> = [
  { node: "sceneHeading", text: "int. taller de mapas — noche" },
  { node: "action", text: "Aurelia despliega la carta sobre la mesa. La tinta todavía huele." },
  { node: "character", text: "aurelia" },
  { node: "parenthetical", text: "(sin levantar la vista)" },
  { node: "dialogue", text: "Mi madre dejó este borde sin cerrar a propósito." },
];

export function MediumsSection() {
  return (
    <Section id="mediums" number="16" title="Bloques por medium">
      <SubSection
        title="Separador de escena"
        description="El corte dentro del capítulo. Atom: no se escribe dentro de él."
      >
        <Specimen label="SceneBreak" hint=".scene-break">
          <EditorSurface>
            <p>La puerta se cerró y el pasillo quedó en silencio.</p>
            <div data-scene-break="" className="scene-break">
              * * *
            </div>
            <p>Tres días después, el puerto olía distinto.</p>
          </EditorSurface>
        </Specimen>
      </SubSection>

      <SubSection
        title="Guion de manga, cómic y webtoon"
        description="Páginas y paneles numerados por contadores CSS. El número no se guarda en ningún sitio."
      >
        <Specimen label="MangaPage con paneles" hint=".manga-page › .panel">
          <EditorSurface>
            <section data-manga-page="" className="manga-page">
              <article data-panel="" className="panel">
                <p>Plano general del puerto bajo la niebla. Amanece.</p>
              </article>
              <article data-panel="" className="panel">
                <p>Primer plano de Aurelia. Aprieta el mapa contra el pecho.</p>
              </article>
            </section>
            <section data-manga-page="" className="manga-page">
              <article data-panel="" className="panel">
                <p>Contrapicado: Bruno la espera al final del muelle.</p>
              </article>
            </section>
          </EditorSurface>
        </Specimen>
      </SubSection>

      <SubSection
        title="Guion audiovisual"
        description="Los cinco bloques del formato Final Draft. Las sangrías y mayúsculas son CSS: lo guardado es la línea tal cual la escribió el autor."
      >
        <Specimen label="Escena completa" hint="p[data-sp] · .sp-*">
          <EditorSurface>
            {SCREENPLAY_LINES.map((line, i) => (
              <p key={i} data-sp={line.node} className={`sp-${line.node}`}>
                {line.text}
              </p>
            ))}
          </EditorSurface>
        </Specimen>

        <Specimen
          label="Los bloques uno a uno"
          hint="cada tipo con su etiqueta del manifiesto"
          className="flex-col items-stretch"
        >
          <EditorSurface>
            {SCREENPLAY_LINES.map((line, i) => (
              <div key={i} className="border-b border-dashed border-border/60 py-2 last:border-0">
                <span className="mb-1 block font-sans text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {SCREENPLAY_LABELS[line.node]}
                </span>
                <p data-sp={line.node} className={`sp-${line.node}`}>
                  {line.text}
                </p>
              </div>
            ))}
          </EditorSurface>
        </Specimen>
      </SubSection>

      <SubSection
        title="Degradación entre mediums"
        description="Los nodos se montan siempre, cambie o no el medium. Si el contenido se abre sin la extensión, un guion cae a párrafos y no se pierde una sola línea."
      >
        <Specimen label="Guion sin la extensión" hint="mismo HTML, sin las reglas .sp-*">
          <div className="w-full">
            {SCREENPLAY_LINES.map((line, i) => (
              <p key={i}>{line.text}</p>
            ))}
          </div>
        </Specimen>
      </SubSection>
    </Section>
  );
}
