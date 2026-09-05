import { describe, expect, it } from "vitest";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import {
  scrubBreadcrumb,
  scrubEvent,
  sentryBaseOptions,
} from "./sentry-options";

/**
 * Lo que el informe de un error puede llevarse de aquí.
 *
 * La afirmación central no es campo por campo, es global: se arma un evento con
 * el capítulo de una novela metido en todos los sitios por donde Sentry lo
 * arrastraría —el cuerpo de la petición, la cookie de sesión, la query, las
 * migas de pan— y se comprueba que la cadena no aparece en el evento ya
 * recortado, en ninguna parte. Un test que enumerara campos se quedaría corto el
 * día que el SDK añada uno nuevo; éste no.
 */

/** El texto que jamás puede salir del servidor de su dueño. */
const CAPITULO = "La Daga apareció en el capítulo dos y nunca más volvió";
const TOKEN = "sk-kino-secreta-de-verdad";

function eventoConTodo(): ErrorEvent {
  return {
    type: undefined,
    request: {
      url: `https://usekino.dev/api/pages/abc?q=${encodeURIComponent(CAPITULO)}`,
      method: "PATCH",
      data: { content: `<p>${CAPITULO}</p>`, title: "Capítulo dos" },
      query_string: `q=${encodeURIComponent(CAPITULO)}`,
      cookies: { "__session": TOKEN },
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: "https://usekino.dev/systems/1",
        cookie: `__session=${TOKEN}`,
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
    },
    user: {
      id: "u-1",
      email: "elias@usekino.dev",
      username: "elias",
      ip_address: "203.0.113.9",
    },
  } as ErrorEvent;
}

describe("scrubEvent · nada personal sale en el informe", () => {
  it("el texto del cuaderno no aparece en ninguna parte del evento", () => {
    const limpio = JSON.stringify(scrubEvent(eventoConTodo()));
    expect(limpio).not.toContain(CAPITULO);
    expect(limpio).not.toContain("La Daga");
  });

  it("la credencial tampoco, ni por cookie ni por cabecera", () => {
    const limpio = JSON.stringify(scrubEvent(eventoConTodo()));
    expect(limpio).not.toContain(TOKEN);
    expect(limpio.toLowerCase()).not.toContain("authorization");
  });

  it("del usuario queda el id, que es lo que dice si falla a uno o a todos", () => {
    const limpio = scrubEvent(eventoConTodo());
    expect(limpio?.user).toEqual({ id: "u-1" });
  });

  it("conserva lo que sirve para reproducir: ruta, método y navegador", () => {
    const limpio = scrubEvent(eventoConTodo());
    expect(limpio?.request?.url).toBe("https://usekino.dev/api/pages/abc");
    expect(limpio?.request?.method).toBe("PATCH");
    expect(limpio?.request?.headers?.["user-agent"]).toBe("Mozilla/5.0");
  });

  it("nunca descarta el evento entero: recorta, no censura el fallo", () => {
    expect(scrubEvent(eventoConTodo())).not.toBeNull();
    expect(scrubEvent({} as ErrorEvent)).not.toBeNull();
  });

  it("una cabecera nueva no se cuela por no estar en ninguna lista negra", () => {
    const evento = eventoConTodo();
    evento.request!.headers = { "x-inventada-mañana": CAPITULO };
    expect(JSON.stringify(scrubEvent(evento))).not.toContain(CAPITULO);
  });
});

describe("scrubBreadcrumb · el otro escape", () => {
  it("descarta las migas de consola, que llevan lo que se imprimió", () => {
    const miga: Breadcrumb = { category: "console", message: CAPITULO };
    expect(scrubBreadcrumb(miga)).toBeNull();
  });

  it("quita el cuerpo de una petición registrada", () => {
    const miga: Breadcrumb = {
      category: "fetch",
      data: { url: "https://usekino.dev/api/pages/abc?q=1", body: CAPITULO, input: CAPITULO },
    };
    expect(JSON.stringify(scrubBreadcrumb(miga))).not.toContain(CAPITULO);
  });

  it("le quita la query a la url pero deja la ruta", () => {
    const miga: Breadcrumb = {
      category: "fetch",
      data: { url: `https://usekino.dev/api/search?q=${CAPITULO}` },
    };
    expect(scrubBreadcrumb(miga)?.data?.url).toBe("https://usekino.dev/api/search");
  });

  it("deja pasar una miga de navegación, que es la que sitúa el error", () => {
    const miga: Breadcrumb = { category: "navigation", data: { from: "/today", to: "/systems" } };
    expect(scrubBreadcrumb(miga)).not.toBeNull();
  });
});

describe("el ruido que no debe generar alertas", () => {
  /** Como el SDK: un mensaje se ignora si casa con algún patrón de la lista. */
  function ignorado(mensaje: string): boolean {
    return sentryBaseOptions.ignoreErrors.some((patron) =>
      typeof patron === "string" ? mensaje.includes(patron) : patron.test(mensaje),
    );
  }

  const ruido = [
    "Extension context invalidated.",
    "Error: chrome-extension://abcdef/inject.js failed",
    "Non-Error promise rejection captured with value: undefined",
    "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
    "ResizeObserver loop completed with undelivered notifications.",
  ];

  for (const mensaje of ruido) {
    it(`ignora: ${mensaje.slice(0, 45)}…`, () => {
      expect(ignorado(mensaje)).toBe(true);
    });
  }

  it("un error de verdad de la app sí llega", () => {
    expect(ignorado("TypeError: Cannot read properties of undefined (reading 'chapters')")).toBe(
      false,
    );
    expect(ignorado("NotFoundError: la página no existe")).toBe(false);
  });

  it("descarta lo que venga de una extensión, sea cual sea el mensaje", () => {
    const deExtension = "chrome-extension://kkkjlfejijcjgjllecmnejhogpbcigdc/content.js";
    expect(sentryBaseOptions.denyUrls.some((patron) => patron.test(deExtension))).toBe(true);
    expect(
      sentryBaseOptions.denyUrls.some((patron) => patron.test("https://usekino.dev/_next/app.js")),
    ).toBe(false);
  });
});

describe("sin clave, inerte en vez de roto", () => {
  it("queda deshabilitado mientras no haya DSN", () => {
    // Es el estado en local y en cualquier despliegue hasta que la clave entre
    // en Vercel. La app tiene que arrancar igual.
    expect(sentryBaseOptions.enabled).toBe(Boolean(sentryBaseOptions.dsn));
  });

  it("no muestrea rendimiento: la cuota gratuita se gasta en fallos", () => {
    expect(sentryBaseOptions.tracesSampleRate).toBe(0);
  });

  it("no pide los datos personales que el SDK manda si se los pides", () => {
    expect(sentryBaseOptions.sendDefaultPii).toBe(false);
  });
});
