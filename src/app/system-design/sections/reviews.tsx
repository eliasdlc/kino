"use client";

import { api } from "@convex/_generated/api";
import { Section, Seeded, SubSection, Specimen, SpecimenGrid, seedQuery } from "../helpers";
import { CommentCard, type CommentCardHandlers } from "@/features/reviews/CommentCard";
import { ReviewProgressBar } from "@/features/reviews/ReviewProgressBar";
import { ReviewPanelBody } from "@/features/reviews/ReviewPanel";
import { ReviewProvider } from "@/features/reviews/ReviewContext";
import type { PageReviewView, ReviewComment, ReviewProgress } from "@/features/reviews/reviews.types";

const AHORA = "2026-10-24T10:00:00.000Z";

const handlers: CommentCardHandlers = {
  onActivate: () => {},
  onResolve: () => {},
  onDismiss: () => {},
  onReopen: () => {},
  onReply: () => {},
  onApply: () => false,
};

function comentario(id: string, extra: Partial<ReviewComment>): ReviewComment {
  return {
    id: id as ReviewComment["id"],
    pageId: "page_muestra" as ReviewComment["pageId"],
    reviewId: "review_muestra" as NonNullable<ReviewComment["reviewId"]>,
    quote: "todas las medidas de seguridad requeridas",
    prefix: null,
    suffix: null,
    category: "argument",
    severity: "critical",
    body: "Exagera y contradice tu propio diagnóstico: QSD tiene controles, pero no todos los requeridos. Más abajo dices que no hay baja de cuentas ni pruebas de restauración.",
    hint: "¿Qué dos controles nombras en la Parte I que contradicen esta frase?",
    suggestion: "ya tiene varios controles de seguridad, aunque no todos los requeridos",
    status: "open",
    resolution: null,
    resolvedAt: null,
    awaiting: null,
    author: "agent",
    replies: [],
    createdAt: AHORA,
    updatedAt: AHORA,
    ...extra,
  };
}

const progreso = (closed: number, total: number, extra: Partial<ReviewProgress> = {}): ReviewProgress => ({
  total,
  closed,
  open: total - closed,
  fraction: total === 0 ? 0 : closed / total,
  openBySeverity: { critical: 1, important: 2, suggestion: Math.max(0, total - closed - 3) },
  closedHow: { edited: closed, applied: 0, marked: 0, verified: 0, dismissed: 0 },
  ...extra,
});

const PANEL: PageReviewView = {
  reviews: [
    {
      id: "review_muestra" as PageReviewView["reviews"][number]["id"],
      summary:
        "El informe está bien ordenado, pero el diagnóstico de la Parte I promete más de lo que demuestra. Lo más urgente es alinear la conclusión con los controles que de verdad faltan.",
      reviewer: "Claude",
      author: "agent",
      closedAt: null,
      createdAt: AHORA,
      progress: null,
    },
  ],
  comments: [
    comentario("c1", {}),
    comentario("c2", {
      quote: "Yo lo inferí",
      category: "style",
      severity: "important",
      body: "En el resto del texto usas «infiero», «deduzco» y «supongo». Elige uno y mantenlo, con las mismas comillas « » que usas en todo el documento.",
      hint: null,
      suggestion: "«Lo inferí»",
    }),
    comentario("c3", {
      quote: "información de verificación",
      category: "clarity",
      severity: "suggestion",
      body: "La tabla 1 usa «Por verificar». Un mismo concepto con dos nombres obliga a quien lee a preguntarse si son dos cosas.",
      hint: null,
      suggestion: null,
      replies: [
        { id: "r1", author: "person", body: "¿Cambio la tabla o el texto?", createdAt: AHORA },
        { id: "r2", author: "agent", body: "El texto: la tabla es la que se cita en los anexos.", createdAt: AHORA },
      ],
      awaiting: "person",
    }),
    comentario("c4", { quote: "Repite la frase", category: "structure", severity: "important", status: "resolved", resolution: "edited" }),
  ],
  progress: progreso(1, 4, { fraction: 2 / 8, openBySeverity: { critical: 1, important: 1, suggestion: 1 } }),
  awaitingAgent: 0,
};

const VACIO: PageReviewView = {
  reviews: [],
  comments: [],
  progress: progreso(0, 0, { openBySeverity: { critical: 0, important: 0, suggestion: 0 } }),
  awaitingAgent: 0,
};

export function ReviewsSection() {
  return (
    <Section
      id="revision"
      number="21"
      title="Revisión de documentos"
      description="El agente de la persona deja comentarios anclados a fragmentos del texto; la persona los cierra uno a uno y la barra se llena. Mide la revisión, nunca el documento."
    >
      <SubSection
        title="El fragmento en el texto"
        description="El color dice el tipo; el peso de la raya, la importancia: crítico grueso, importante normal, detalle punteado. Un lavado suave deja ver de un vistazo qué hay y dónde; el comentario que se está mirando lo sube. Una pregunta de la persona va en ámbar."
      >
        <div className="tiptap-editor max-w-2xl rounded-lg border bg-card p-6 text-sm leading-7">
          <p>
            <span className="review-anchor review-anchor-important review-cat-structure">La información puede ser clasificada como prueba</span>{" "}
            si se encuentra en el caso. Mi impresión es que QSD ya tiene{" "}
            <span className="review-anchor review-anchor-critical review-cat-argument review-anchor-active">
              todas las medidas de seguridad requeridas
            </span>
            , según{" "}
            <span className="review-anchor review-anchor-important review-cat-evidence">el informe mensual del proveedor</span>. Será
            llamada <span className="review-anchor review-anchor-suggestion review-cat-clarity">información de verificación</span> cuando
            falte algo. Usaría la frase <span className="review-anchor review-anchor-important review-cat-style">Yo lo inferí</span>, y{" "}
            <span className="review-anchor review-anchor-suggestion review-cat-grammar">como prueba</span> lleva coma. Sobre{" "}
            <span className="review-anchor review-anchor-question">esto</span> tengo una pregunta.
          </p>
        </div>
      </SubSection>

      <SubSection
        title="ReviewProgressBar"
        description="Se llena por peso: cerrar lo crítico avanza más que cerrar un detalle. Dice lo que queda con palabras. Llena, cambia a hecha."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Recién llegada" hint="closed 0 de 8">
            <ReviewProgressBar className="w-full" progress={progreso(0, 8, { openBySeverity: { critical: 2, important: 3, suggestion: 3 } })} />
          </Specimen>
          <Specimen label="Recta final" hint="quedan 2">
            <ReviewProgressBar
              className="w-full"
              progress={progreso(6, 8, { fraction: 0.82, openBySeverity: { critical: 0, important: 1, suggestion: 1 } })}
            />
          </Specimen>
          <Specimen label="Todo cerrado" hint="open 0">
            <ReviewProgressBar className="w-full" progress={progreso(8, 8, { fraction: 1, openBySeverity: { critical: 0, important: 0, suggestion: 0 } })} />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="CommentCard"
        description="La franja y el icono llevan el color del tipo; la señal de tres barras, la importancia. Después: qué fragmento, qué pasa y por qué, una pista para pensarlo y la propuesta sólo si se pide. Un fragmento reescrito ofrece «Lo arreglé»; uno que ya no está se tacha."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Abierto, activo" hint="anchor here" className="items-start">
            <div className="w-full">
              <CommentCard comment={comentario("e1", {})} reviewer="Claude" anchor="here" active {...handlers} />
            </div>
          </Specimen>
          <Specimen label="Reescrito por la persona" hint="anchor edited" className="items-start">
            <div className="w-full">
              <CommentCard comment={comentario("e2", { severity: "important", hint: null })} reviewer="Claude" anchor="edited" active={false} {...handlers} />
            </div>
          </Specimen>
          <Specimen label="Sin fragmento" hint="anchor missing" className="items-start">
            <div className="w-full">
              <CommentCard
                comment={comentario("e3", { severity: "suggestion", category: "grammar", hint: null, suggestion: null, body: "Falta la coma." })}
                reviewer="Claude"
                anchor="missing"
                active={false}
                {...handlers}
              />
            </div>
          </Specimen>
          <Specimen label="Pregunta de la persona" hint="reviewId null, awaiting agent" className="items-start">
            <div className="w-full">
              <CommentCard
                comment={comentario("e4", {
                  reviewId: null,
                  category: null,
                  severity: null,
                  author: "person",
                  hint: null,
                  suggestion: null,
                  quote: "pruebas de restauración",
                  body: "¿Esto cuenta como control si nunca se hizo?",
                  awaiting: "agent",
                })}
                reviewer="Claude"
                anchor="here"
                active={false}
                {...handlers}
              />
            </div>
          </Specimen>
          <Specimen label="Comprobado por el agente" hint="resolution verified" className="items-start">
            <div className="w-full">
              <CommentCard
                comment={comentario("e5", { status: "resolved", resolution: "verified", hint: null, suggestion: null })}
                reviewer="Claude"
                anchor={null}
                active={false}
                {...handlers}
              />
            </div>
          </Specimen>
          <Specimen label="Descartado" hint="status dismissed" className="items-start">
            <div className="w-full">
              <CommentCard
                comment={comentario("e6", {
                  status: "dismissed",
                  severity: "suggestion",
                  hint: null,
                  suggestion: null,
                  replies: [{ id: "r3", author: "person", body: "Lo quiero así", createdAt: AHORA }],
                })}
                reviewer="Claude"
                anchor={null}
                active={false}
                {...handlers}
              />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="ReviewPanelBody"
        description="El panel entero: barra, veredicto, la instrucción para el agente, pestañas y la lista en el orden del texto. En escritorio es una columna junto al documento; en el teléfono, una hoja que sube."
      >
        <div className="flex h-[44rem] max-w-[22rem] flex-col overflow-hidden rounded-[1.375rem] border bg-card">
          <Seeded stubs={[seedQuery(api.reviews.byPage, PANEL)]}>
            <ReviewProvider initialOpen>
              <ReviewPanelBody pageId="page_muestra" title="Informe de seguridad de QSD" initialData={PANEL} />
            </ReviewProvider>
          </Seeded>
        </div>
        <div className="mt-4 flex h-[22rem] max-w-[22rem] flex-col overflow-hidden rounded-[1.375rem] border bg-card">
          <Seeded stubs={[seedQuery(api.reviews.byPage, VACIO)]}>
            <ReviewProvider initialOpen>
              <ReviewPanelBody pageId="page_vacia" title="Ensayo" initialData={VACIO} />
            </ReviewProvider>
          </Seeded>
        </div>
      </SubSection>
    </Section>
  );
}
