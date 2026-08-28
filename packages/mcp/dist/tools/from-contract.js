import { z } from 'zod';
import { OPERATIONS } from '../generated/operations.js';
import { CATALOG } from './catalog.js';
/**
 * Convierte el contrato de Kino en tools del MCP.
 *
 * Lo que antes se escribía tres veces —el schema Zod, la URL y el método— ahora
 * sale de `OPERATIONS`, que se genera del contrato que sirve la API. Lo único
 * escrito a mano es lo que el agente lee: el nombre y la descripción.
 *
 * La validación que se monta aquí es la primera línea, no la autoridad: los
 * refinamientos no tienen forma en JSON Schema y se quedan por el camino. Quien
 * decide sigue siendo el endpoint, que valida con el schema original.
 */
const PATH_PARAM = /\{\+?([^}]+)\}/g;
/** Los huecos de la ruta salen de la entrada; el resto va en query o en body. */
function pathParams(path) {
    return [...path.matchAll(PATH_PARAM)].map(([, name]) => name);
}
function buildUrl(operation, input) {
    const params = pathParams(operation.path);
    const path = operation.path.replace(PATH_PARAM, (_, name) => encodeURIComponent(String(input[name] ?? '')));
    const rest = Object.fromEntries(Object.entries(input).filter(([key, value]) => !params.includes(key) && value !== undefined));
    if (operation.method !== 'GET' && operation.method !== 'DELETE') {
        return { url: `/api${path}`, body: rest };
    }
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(rest))
        query.set(key, String(value));
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return { url: `/api${path}${suffix}`, body: undefined };
}
/** El schema de la entrada, sin los parámetros que la tool fija por su cuenta. */
function inputShape(operation, spec) {
    const schema = z.fromJSONSchema(operation.input);
    if (!(schema instanceof z.ZodObject))
        return {};
    const shape = {};
    for (const [name, field] of Object.entries(schema.shape)) {
        if (spec.hiddenParams?.includes(name))
            continue;
        const prose = spec.params?.[name];
        shape[name] = prose ? field.describe(prose) : field;
    }
    return shape;
}
function register(server, kinoFetch, id, spec) {
    const operation = OPERATIONS[id];
    server.tool(spec.name, spec.description, inputShape(operation, spec), async (raw) => {
        const merged = { ...raw, ...spec.fixedInput };
        const input = spec.prepareInput ? spec.prepareInput(merged) : merged;
        const { url, body } = buildUrl(operation, input);
        const result = await kinoFetch(url, {
            method: operation.method,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = spec.confirmation
            ? spec.confirmation(input)
            : JSON.stringify((spec.mapResult ? spec.mapResult(result) : result) ?? { ok: true }, null, 2);
        return { content: [{ type: 'text', text }] };
    });
}
/** Registra una tool por cada operación que el catálogo expone. */
export function registerContractTools(server, kinoFetch) {
    for (const [id, entry] of Object.entries(CATALOG)) {
        if (!entry)
            continue;
        for (const spec of Array.isArray(entry) ? entry : [entry]) {
            register(server, kinoFetch, id, spec);
        }
    }
}
