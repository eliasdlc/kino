/**
 * Criterio: el POST se intercepta, lo compartido queda guardado, sale el
 * redirect a una ruta GET, y nada de eso toca la red. La parte mecánica no
 * puede depender del pulgar de nadie, así que el handler recibe su almacén y
 * aquí corre entero sin navegador.
 */
import { describe, expect, it, vi } from "vitest";
import {
  atenderCompartido,
  colaSinDueno,
  pareceEnlace,
  registroDesdeFormData,
  registrosDe,
  type RegistroCompartido,
} from "./shareTarget";

const AHORA = 1_757_800_000_000;

function deps(ownerId: string | null = "user-1") {
  const cola: RegistroCompartido[] = [];
  return {
    cola,
    guardar: vi.fn(async (registro: RegistroCompartido) => void cola.push(registro)),
    duenoActual: async () => ownerId,
    nuevoId: () => "reg-1",
    ahora: () => AHORA,
  };
}

function postDe(form: FormData) {
  return new Request("https://kino.app/compartir", { method: "POST", body: form });
}

function formCon(pares: Record<string, string | File>) {
  const form = new FormData();
  for (const [clave, valor] of Object.entries(pares)) form.append(clave, valor);
  return form;
}

describe("registroDesdeFormData", () => {
  const sinMundo = { nuevoId: () => "reg-1", ahora: () => AHORA };

  it("una foto se reconoce por su MIME y guarda su tamaño", () => {
    const foto = new File([new Uint8Array(2048)], "pizarra.jpg", { type: "image/jpeg" });

    const registro = registroDesdeFormData(formCon({ imagen: foto }), sinMundo, "user-1");

    expect(registro).toMatchObject({ kind: "photo", name: "pizarra.jpg", size: 2048, blob: foto });
  });

  it("una nota de voz es audio, no foto", () => {
    const voz = new File([new Uint8Array(64)], "nota.m4a", { type: "audio/mp4" });

    expect(registroDesdeFormData(formCon({ audio: voz }), sinMundo, "user-1").kind).toBe("voice");
  });

  it("el archivo manda sobre el texto que lo acompaña", () => {
    const foto = new File([new Uint8Array(8)], "pizarra.jpg", { type: "image/jpeg" });

    const registro = registroDesdeFormData(
      formCon({ imagen: foto, texto: "mira esto" }),
      sinMundo,
      "user-1",
    );

    expect(registro.kind).toBe("photo");
    expect(registro.text).toBeNull();
  });

  it("un enlace se reconoce por su forma, venga en el campo que venga", () => {
    const enCampoPropio = registroDesdeFormData(
      formCon({ url: "https://react.dev/learn" }),
      sinMundo,
      "user-1",
    );
    const dentroDelTexto = registroDesdeFormData(
      formCon({ texto: "https://react.dev/learn" }),
      sinMundo,
      "user-1",
    );

    expect(enCampoPropio.kind).toBe("link");
    expect(dentroDelTexto.kind).toBe("link");
    expect(dentroDelTexto.url).toBe("https://react.dev/learn");
  });

  it("una frase con un enlace dentro sigue siendo texto", () => {
    const registro = registroDesdeFormData(
      formCon({ texto: "mira https://react.dev/learn cuando puedas" }),
      sinMundo,
      "user-1",
    );

    expect(registro.kind).toBe("text");
    expect(registro.text).toContain("cuando puedas");
  });

  it("pareceEnlace no se traga un texto con espacios ni un protocolo raro", () => {
    expect(pareceEnlace("https://react.dev")).toBe(true);
    expect(pareceEnlace("  https://react.dev  ")).toBe(true);
    expect(pareceEnlace("react.dev/learn")).toBe(false);
    expect(pareceEnlace("javascript:alert(1)")).toBe(false);
    expect(pareceEnlace("")).toBe(false);
  });
});

describe("atenderCompartido", () => {
  it("guarda lo compartido y redirige a una ruta GET con su recibo", async () => {
    const d = deps();
    const foto = new File([new Uint8Array(16)], "pizarra.jpg", { type: "image/jpeg" });

    const respuesta = await atenderCompartido(postDe(formCon({ imagen: foto })), d);

    expect(respuesta.status).toBe(303);
    expect(respuesta.headers.get("Location")).toBe("/compartir?recibo=reg-1");
    expect(d.cola).toHaveLength(1);
    expect(d.cola[0]).toMatchObject({ kind: "photo", estado: "pendiente", ownerId: "user-1" });
  });

  it("sin red hace exactamente lo mismo: no hay ninguna petición que fallar", async () => {
    const d = deps();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const respuesta = await atenderCompartido(postDe(formCon({ texto: "idea suelta" })), d);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(respuesta.status).toBe(303);
    expect(d.cola[0]).toMatchObject({ kind: "text", text: "idea suelta" });
    fetchSpy.mockRestore();
  });

  it("sin sesión escrita el registro nace sin dueño y no se le enseña a nadie", async () => {
    const d = deps(null);

    await atenderCompartido(postDe(formCon({ texto: "idea suelta" })), d);

    expect(d.cola[0]!.ownerId).toBeNull();
    expect(registrosDe(d.cola, "user-1")).toHaveLength(0);
  });
});

describe("la cola acotada por usuario", () => {
  const cola: RegistroCompartido[] = [
    { ownerId: "user-1", id: "a" } as RegistroCompartido,
    { ownerId: "user-2", id: "b" } as RegistroCompartido,
    { ownerId: null, id: "c" } as RegistroCompartido,
  ];

  it("con dos cuentas en el mismo navegador la cola no cruza", () => {
    expect(registrosDe(cola, "user-1").map((r) => r.id)).toEqual(["a"]);
    expect(registrosDe(cola, "user-2").map((r) => r.id)).toEqual(["b"]);
  });

  it("cerrar sesión vacía lo suyo y deja lo de la otra cuenta en pie", () => {
    expect(colaSinDueno(cola, "user-1").map((r) => r.id)).toEqual(["b", "c"]);
  });
});
