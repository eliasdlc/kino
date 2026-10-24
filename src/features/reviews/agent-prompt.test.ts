import { describe, expect, it } from "vitest";
import { agentPrompt, nextAsk } from "./agent-prompt";

// La frase que la persona le pega a su agente tiene que nombrar la página por
// su id y las tools por su nombre, y cambiar según en qué punto está la
// revisión: pedir la primera pasada cuando ya hay una sería empezar de cero.

const base = { pageId: "page_123", title: "Informe de seguridad", hasReviews: false, awaitingAgent: 0 };

describe("nextAsk", () => {
  it("pide la primera pasada, otra pasada, o sólo respuestas", () => {
    expect(nextAsk({ hasReviews: false, awaitingAgent: 0 })).toBe("review");
    expect(nextAsk({ hasReviews: false, awaitingAgent: 2 })).toBe("answer");
    expect(nextAsk({ hasReviews: true, awaitingAgent: 0 })).toBe("rereview");
  });
});

describe("agentPrompt", () => {
  it("la primera pasada nombra la página y las dos tools que hacen falta", () => {
    const prompt = agentPrompt(base);
    expect(prompt).toContain("page_123");
    expect(prompt).toContain("«Informe de seguridad»");
    expect(prompt).toContain("get_page");
    expect(prompt).toContain("review_page");
  });

  it("la segunda pasada pide comprobar antes de resolver, y cuenta los hilos que esperan", () => {
    const prompt = agentPrompt({ ...base, hasReviews: true, awaitingAgent: 3 });
    expect(prompt).toContain("list_page_comments");
    expect(prompt).toContain("los 3 hilos");
    expect(prompt).toContain("sólo lo que compruebes arreglado");
  });

  it("sin hilos pendientes no los menciona", () => {
    expect(agentPrompt({ ...base, hasReviews: true })).not.toContain("reply_to_page_comment");
  });
});
