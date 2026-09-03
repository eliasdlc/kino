import { describe, expect, it } from "vitest";
import { sanitizePageHtml } from "./sanitize";

/**
 * El escenario que cierra este saneo: un agente lee un texto que no controla,
 * alguien le cuela una instrucción, y el agente guarda la página por MCP con una
 * etiqueta que ejecuta. Cada caso de aquí es una de esas etiquetas, y la
 * afirmación es siempre la misma: lo que queda no puede correr.
 */

/** Lo que un navegador ejecutaría del HTML resultante. */
function executable(html: string): boolean {
  return (
    /<\s*(script|iframe|object|embed|svg|math|form|base|link|meta|style)\b/i.test(html) ||
    // Cualquier `on*=` sobreviviente.
    /\son[a-z]+\s*=/i.test(html) ||
    /javascript\s*:/i.test(html)
  );
}

describe("sanitizePageHtml · lo que no puede sobrevivir", () => {
  const payloads: Record<string, string> = {
    script: '<p>hola</p><script>alert(1)</script>',
    "img con onerror": '<img src="x" onerror="alert(1)">',
    "onclick en un párrafo": '<p onclick="alert(1)">click</p>',
    "enlace javascript:": '<a href="javascript:alert(1)">click</a>',
    "enlace javascript: con espacios": '<a href="java\tscript:alert(1)">click</a>',
    iframe: '<iframe src="https://evil.test"></iframe>',
    "svg con onload": '<svg onload="alert(1)"></svg>',
    "form con formaction": '<form action="/x"><button formaction="javascript:alert(1)">go</button></form>',
    "style con expression": '<style>body{background:url("javascript:alert(1)")}</style>',
    "meta refresh": '<meta http-equiv="refresh" content="0;url=https://evil.test">',
    "base que reescribe los enlaces": '<base href="https://evil.test/">',
    "object": '<object data="data:text/html,<script>alert(1)</script>"></object>',
    "srcdoc": '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    "atributo con mayúsculas": '<IMG SRC="x" ONERROR="alert(1)">',
    "handler sin comillas": '<img src=x onerror=alert(1)>',
    "etiqueta anidada para burlar un filtro ingenuo": '<scr<script>ipt>alert(1)</script>',
    "style inline con position fixed": '<p style="position:fixed;top:0;left:0;width:100vw">tapado</p>',
  };

  for (const [name, payload] of Object.entries(payloads)) {
    it(`neutraliza: ${name}`, () => {
      const clean = sanitizePageHtml(payload);
      expect(executable(clean), `quedó ejecutable: ${clean}`).toBe(false);
    });
  }

  it("no devuelve el texto del script como texto plano al filtrarlo", () => {
    expect(sanitizePageHtml("<script>alert(1)</script>")).not.toContain("alert");
  });

  it("deja el texto legible cuando sólo sobra el envoltorio", () => {
    expect(sanitizePageHtml('<p onclick="alert(1)">el capítulo</p>')).toBe(
      "<p>el capítulo</p>",
    );
  });
});

describe("sanitizePageHtml · enlaces e imágenes", () => {
  it("conserva un enlace normal y le pone rel contra window.opener", () => {
    const clean = sanitizePageHtml('<a href="https://usekino.dev">Kino</a>');
    expect(clean).toContain('href="https://usekino.dev"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it("conserva mailto, que es un enlace legítimo en un manuscrito", () => {
    expect(sanitizePageHtml('<a href="mailto:a@b.test">escribe</a>')).toContain(
      'href="mailto:a@b.test"',
    );
  });

  it("deja el texto del enlace pero le quita el href cuando el esquema no vale", () => {
    const clean = sanitizePageHtml('<a href="javascript:alert(1)">click</a>');
    expect(clean).toContain("click");
    expect(clean).not.toContain("href");
  });

  it("permite una imagen embebida en data:, que es como pega el editor", () => {
    const clean = sanitizePageHtml('<img src="data:image/png;base64,iVBORw0KG" alt="x">');
    expect(clean).toContain("data:image/png");
  });

  it("no permite un data:text/html en el src de una imagen", () => {
    expect(sanitizePageHtml('<img src="data:text/html,<script>alert(1)</script>">')).not.toContain(
      "text/html",
    );
  });
});

describe("sanitizePageHtml · lo que sí tiene que pasar", () => {
  it("conserva la anchura de columna de una tabla redimensionada", () => {
    const clean = sanitizePageHtml('<table><colgroup><col style="width: 120px"></colgroup></table>');
    expect(clean).toContain("width:120px");
  });

  it("tira cualquier otra declaración de style", () => {
    const clean = sanitizePageHtml('<td style="width: 120px; background: url(x)">a</td>');
    expect(clean).toContain("width:120px");
    expect(clean).not.toContain("background");
  });

  it("conserva las clases, de las que depende que el capítulo se vea igual", () => {
    expect(sanitizePageHtml('<img src="https://x.test/a.png" class="rounded-lg">')).toContain(
      'class="rounded-lg"',
    );
  });

  it("devuelve cadena vacía para nulo o vacío", () => {
    expect(sanitizePageHtml(null)).toBe("");
    expect(sanitizePageHtml(undefined)).toBe("");
    expect(sanitizePageHtml("")).toBe("");
  });
});
