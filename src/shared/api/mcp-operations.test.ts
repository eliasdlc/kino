import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/db", () => ({ db: {} }));

const { renderOperationsFile, OPERATIONS_FILE } = await import(
  "../../../scripts/generate-mcp-operations"
);

/**
 * El paquete `@kino-app/mcp` se publica en npm y no puede importar `src/`: la
 * dependencia va al revés. Por eso el contrato viaja hasta él como código
 * generado, y por eso hace falta esto.
 *
 * Sin este test, añadir un endpoint y olvidarse de regenerar dejaría al MCP
 * sirviendo una foto vieja del contrato, que es exactamente el problema que la
 * fase venía a quitar. Con él, el olvido es un fallo de CI y no un error en
 * mitad de una sesión con el agente.
 */
describe("las operaciones que ve el MCP", () => {
  it("son las del contrato de ahora mismo", () => {
    const committed = readFileSync(OPERATIONS_FILE, "utf-8");

    expect(committed).toBe(renderOperationsFile());
  });
});
