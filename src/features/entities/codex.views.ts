import { Library, Network, Scissors, type LucideIcon } from "lucide-react";

/**
 * Las lecturas del codex. El universo es uno solo; lo que cambia es desde dónde
 * se mira — la biblioteca lo lista, el grafo lo dibuja. Añadir una lectura nueva
 * es añadir una entrada aquí, no un fork en la página.
 */
export const CODEX_VIEWS = [
  { id: "biblioteca", label: "Biblioteca", icon: Library },
  { id: "grafo", label: "Grafo", icon: Network },
  { id: "hilos", label: "Hilos sueltos", icon: Scissors },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>;

export type CodexViewId = (typeof CODEX_VIEWS)[number]["id"];

export const DEFAULT_CODEX_VIEW: CodexViewId = "biblioteca";

export function resolveCodexView(raw: string | undefined): CodexViewId {
  const match = CODEX_VIEWS.find((v) => v.id === raw);
  return match?.id ?? DEFAULT_CODEX_VIEW;
}
