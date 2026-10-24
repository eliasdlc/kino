/**
 * La instrucción que la persona le pega a su agente (Claude Code, Claude
 * Desktop o cualquiera con el conector de Kino) para que revise, vuelva a
 * revisar o conteste.
 *
 * Existe porque Kino no llama a ningún modelo: quien revisa es el agente de la
 * persona, y pedírselo no debería exigir saberse el nombre de las tools. La
 * frase nombra la página por su id y las tools por su nombre, así que el
 * agente no tiene que adivinar cuál es «mi documento».
 */

export type AgentAsk = "review" | "rereview" | "answer";

export interface AgentPromptInput {
  pageId: string;
  title: string | null;
  /** Hay alguna pasada en la página. */
  hasReviews: boolean;
  /** Hilos que esperan respuesta del agente. */
  awaitingAgent: number;
}

/** Qué conviene pedir ahora: la primera pasada, una segunda, o sólo respuestas. */
export function nextAsk({ hasReviews, awaitingAgent }: Pick<AgentPromptInput, "hasReviews" | "awaitingAgent">): AgentAsk {
  if (!hasReviews) return awaitingAgent > 0 ? "answer" : "review";
  return "rereview";
}

export const ASK_LABEL: Record<AgentAsk, string> = {
  review: "Pedir una revisión",
  rereview: "Pedir otra pasada",
  answer: "Pedir respuestas",
};

export function agentPrompt(input: AgentPromptInput, ask: AgentAsk = nextAsk(input)): string {
  const nombre = input.title?.trim() ? `«${input.title.trim()}»` : "sin título";
  const pagina = `la página ${nombre} de Kino (pageId: ${input.pageId})`;
  if (ask === "review") {
    return (
      `Revisa ${pagina}. Léela con get_page y deja una pasada con review_page: ` +
      `doce comentarios o menos, de lo grande a lo pequeño, cada uno anclado a una cita exacta y con el porqué. ` +
      `No reescribas el documento: comenta, y deja la propuesta sólo donde ayude.`
    );
  }
  if (ask === "answer") {
    return `Contesta mis preguntas en ${pagina}. Están en list_page_comments con awaiting: agent; responde cada una con reply_to_page_comment.`;
  }
  const respuestas =
    input.awaitingAgent > 0
      ? `contesta con reply_to_page_comment los ${input.awaitingAgent === 1 ? "hilo" : `${input.awaitingAgent} hilos`} donde te respondí, `
      : "";
  return (
    `Vuelve a revisar ${pagina}. Con list_page_comments y get_page mira qué cambió: ` +
    respuestas +
    `resuelve con resolve_page_comment sólo lo que compruebes arreglado, retira lo que ya no aplique ` +
    `y deja comentarios nuevos con review_page sólo si hacen falta.`
  );
}
