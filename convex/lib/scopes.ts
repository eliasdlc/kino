// Qué puede hacer quien llama. El dueño entra por el navegador y lo puede
// todo; un cliente OAuth del MCP entra con el alcance que Elias le dio al
// autorizarlo, y ese alcance viaja en el JWT como `kino_scope`.

export const SCOPES = ['read', 'propose', 'write'] as const;
export type Scope = (typeof SCOPES)[number];

/** Orden de fuerza: escribir incluye proponer, proponer incluye leer. */
const RANK: Record<Scope, number> = { read: 0, propose: 1, write: 2 };

export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value);
}

export function allows(granted: Scope, required: Scope): boolean {
  return RANK[granted] >= RANK[required];
}
