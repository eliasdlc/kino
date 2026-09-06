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

/**
 * Hasta dónde llega un agente en cada función. El alcance del token dice qué
 * puede pedir; esto dice qué le dejamos hacer, y son cosas distintas: una
 * función puede exigir `write` y aun así no estar abierta a nadie que no sea
 * el navegador.
 *
 * Es el principio 2 escrito donde se aplica: se escribe lo reversible, se
 * propone lo que suplanta tu voz, y lo que no se puede deshacer no se toca
 * desde fuera.
 */
export const REACHES = ['readOnly', 'direct', 'proposed', 'closed'] as const;
export type Reach = (typeof REACHES)[number];

/** El alcance mínimo del token que cada uno exige. */
export const SCOPE_FOR_REACH: Record<Reach, Scope> = {
  readOnly: 'read',
  proposed: 'propose',
  direct: 'write',
  // `closed` exige `write` y además sesión de navegador: el alcance no basta.
  closed: 'write',
};

export function isReach(value: unknown): value is Reach {
  return typeof value === 'string' && (REACHES as readonly string[]).includes(value);
}
