import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { DocsContent } from "./DocsContent";

/**
 * La documentación pública promete cosas sobre el manifiesto de arquetipos, y el
 * manifiesto se toca a menudo. Estos tests son el contrato entre los dos: añadir
 * un `systemType` sin contarlo en `/docs` deja de compilar la promesa.
 *
 * Es la comprobación que faltaba cuando la sección se quedó en cinco arquetipos
 * mientras el manifiesto crecía a siete.
 */

/** Rangos de emoji. La interfaz usa iconos de lucide o texto, nunca esto. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("DocsContent", () => {
  it("cuenta todos los arquetipos que declara el manifiesto", () => {
    const { container } = render(<DocsContent />);
    const text = container.textContent ?? "";

    for (const { label } of Object.values(SYSTEM_TYPE_CONFIG)) {
      expect(text, `falta el arquetipo "${label}" en /docs`).toContain(label);
    }
  });

  it("no vende como pendiente nada de lo que ya existe", () => {
    const { container } = render(<DocsContent />);

    expect(container.textContent).not.toContain("Pronto");
  });

  it("no usa emojis como iconos", () => {
    const { container } = render(<DocsContent />);

    expect(EMOJI.test(container.textContent ?? "")).toBe(false);
  });
});
