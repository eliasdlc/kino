import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SanitizedHtml } from "./SanitizedHtml";

/**
 * El componente montado de verdad, no la función suelta.
 *
 * `sanitize.test.ts` afirma cosas sobre una cadena; esto afirma que lo que
 * termina en el DOM está limpio, que es lo que de hecho corre. Cubre los dos
 * puntos de render —el modo lectura y la vista previa del historial—, porque los
 * dos pasan por aquí y no hay otra forma de pintar `pages.content`.
 */

/** Lo que un agente con una instrucción colada podría llegar a guardar. */
const ATTACK =
  '<h1>Capitulo uno</h1>' +
  '<p><strong>negrita</strong> <a href="https://usekino.dev">enlace</a></p>' +
  '<table><tbody><tr><td colspan="2"><p>celda</p></td></tr></tbody></table>' +
  '<img src="https://blob.test/a.png" class="rounded-lg" alt="portada">' +
  '<img src="x" onerror="window.__PWNED = 1">' +
  '<script>window.__PWNED = 1</script>' +
  '<iframe src="https://evil.test"></iframe>' +
  '<svg onload="window.__PWNED = 1"></svg>' +
  '<a href="javascript:alert(1)">no me pulses</a>';

describe("SanitizedHtml", () => {
  it("no deja nada ejecutable en el DOM", () => {
    const { container } = render(<SanitizedHtml html={ATTACK} />);

    expect(container.querySelectorAll("script")).toHaveLength(0);
    expect(container.querySelectorAll("iframe")).toHaveLength(0);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(
      container.querySelectorAll("[onerror], [onload], [onclick]"),
    ).toHaveLength(0);
  });

  it("deja sin href el enlace javascript: y conserva el legítimo", () => {
    const { container } = render(<SanitizedHtml html={ATTACK} />);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));

    expect(hrefs).toContain("https://usekino.dev");
    expect(hrefs.some((href) => href?.includes("javascript"))).toBe(false);
  });

  it("el capítulo se sigue viendo: título, formato, tabla e imagen", () => {
    const { container } = render(<SanitizedHtml html={ATTACK} />);

    expect(container.querySelector("h1")?.textContent).toBe("Capitulo uno");
    expect(container.querySelectorAll("strong")).toHaveLength(1);
    expect(container.querySelector("td")?.getAttribute("colspan")).toBe("2");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://blob.test/a.png",
    );
    expect(container.querySelector("img")?.getAttribute("class")).toBe("rounded-lg");
  });

  it("un contenido nulo pinta un contenedor vacío, no revienta", () => {
    const { container } = render(<SanitizedHtml html={null} />);
    expect(container.querySelector("div")?.innerHTML).toBe("");
  });

  it("respeta las props del contenedor, de las que dependen los estilos de lectura", () => {
    const { container } = render(
      <SanitizedHtml html="<p>hola</p>" className="reading-surface" data-layout="book" />,
    );
    const host = container.querySelector("div");

    expect(host?.getAttribute("class")).toBe("reading-surface");
    expect(host?.getAttribute("data-layout")).toBe("book");
  });
});
