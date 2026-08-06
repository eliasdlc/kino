import { describe, it, expect, vi } from "vitest";
import { bundleImages } from "./image-bundle";
import type { ImageStorage } from "./image-storage";

const HOST = "https://abc.public.blob.vercel-storage.com/u/user-1";

function blob(bytes: number): ArrayBuffer {
  return new ArrayBuffer(bytes);
}

/** Storage falso: posee lo que cuelga de HOST y sirve el tamaño que se le diga. */
function fakeStorage(
  sizes: Record<string, number | "fail">,
  onDownload?: (url: string) => void,
): ImageStorage {
  return {
    upload: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    deleteMany: vi.fn(),
    owns: (url) => url.startsWith(HOST),
    download: async (url) => {
      onDownload?.(url);
      const size = sizes[url];
      if (size === undefined || size === "fail") return null;
      return { data: blob(size), contentType: "image/webp" };
    },
  };
}

describe("bundleImages", () => {
  it("empaqueta las imágenes propias y las mapea por URL", async () => {
    const a = `${HOST}/a.webp`;
    const b = `${HOST}/b.webp`;
    const out = await bundleImages([a, b], fakeStorage({ [a]: 10, [b]: 20 }));

    expect(out.files.map((f) => f.name)).toEqual(["a.webp", "b.webp"]);
    expect(out.byUrl.get(a)).toBe("a.webp");
    expect(out.byUrl.get(b)).toBe("b.webp");
    expect(out.skipped).toBe(0);
  });

  it("ignora las URLs ajenas sin intentar descargarlas", async () => {
    const propia = `${HOST}/a.webp`;
    const ajena = "https://ajena.example/foto.png";
    const visitadas: string[] = [];
    const out = await bundleImages(
      [propia, ajena],
      fakeStorage({ [propia]: 10 }, (url) => visitadas.push(url)),
    );

    expect(visitadas).toEqual([propia]);
    expect(out.byUrl.has(ajena)).toBe(false);
    // Una URL ajena no es un fallo: nunca estuvo en el presupuesto.
    expect(out.skipped).toBe(0);
  });

  it("deduplica la misma URL repetida", async () => {
    const a = `${HOST}/a.webp`;
    const visitadas: string[] = [];
    const out = await bundleImages([a, a, a], fakeStorage({ [a]: 10 }, (u) => visitadas.push(u)));

    expect(visitadas).toHaveLength(1);
    expect(out.files).toHaveLength(1);
  });

  it("cuenta como saltada la imagen que no se pudo descargar", async () => {
    const a = `${HOST}/a.webp`;
    const rota = `${HOST}/rota.webp`;
    const out = await bundleImages([a, rota], fakeStorage({ [a]: 10, [rota]: "fail" }));

    expect(out.files.map((f) => f.name)).toEqual(["a.webp"]);
    expect(out.byUrl.has(rota)).toBe(false);
    expect(out.skipped).toBe(1);
  });

  it("sobrevive a un download que lanza", async () => {
    const a = `${HOST}/a.webp`;
    const storage = fakeStorage({ [a]: 10 });
    storage.download = async () => {
      throw new Error("red caída");
    };
    const out = await bundleImages([a], storage);

    expect(out.files).toHaveLength(0);
    expect(out.skipped).toBe(1);
  });

  it("respeta el tope de imágenes", async () => {
    const urls = ["a", "b", "c"].map((n) => `${HOST}/${n}.webp`);
    const sizes = Object.fromEntries(urls.map((u) => [u, 10]));
    const out = await bundleImages(urls, fakeStorage(sizes), {
      maxImages: 2,
      concurrency: 1,
    });

    expect(out.files).toHaveLength(2);
    expect(out.skipped).toBe(1);
  });

  it("respeta el tope de bytes y no deja entrar la que lo revienta", async () => {
    const a = `${HOST}/a.webp`;
    const grande = `${HOST}/grande.webp`;
    const out = await bundleImages([a, grande], fakeStorage({ [a]: 100, [grande]: 5_000 }), {
      maxTotalBytes: 1_000,
      concurrency: 1,
    });

    expect(out.files.map((f) => f.name)).toEqual(["a.webp"]);
    expect(out.skipped).toBe(1);
  });

  it("para al agotarse el plazo y reporta lo que quedó fuera", async () => {
    const urls = ["a", "b", "c", "d"].map((n) => `${HOST}/${n}.webp`);
    const sizes = Object.fromEntries(urls.map((u) => [u, 10]));
    let tick = 0;
    // El reloj avanza 1000ms por consulta: con deadline 2500 solo entran las primeras.
    const now = () => (tick++) * 1000;
    const out = await bundleImages(urls, fakeStorage(sizes), { concurrency: 1, deadlineMs: 2_500 }, now);

    expect(out.files.length).toBeGreaterThan(0);
    expect(out.files.length).toBeLessThan(4);
    expect(out.files.length + out.skipped).toBe(4);
  });

  it("desambigua nombres de archivo repetidos", async () => {
    const a = `${HOST}/x/foto.webp`;
    const b = `${HOST}/y/foto.webp`;
    const out = await bundleImages([a, b], fakeStorage({ [a]: 10, [b]: 10 }), { concurrency: 1 });

    expect(out.files.map((f) => f.name)).toEqual(["foto.webp", "foto-2.webp"]);
    expect(out.byUrl.get(a)).toBe("foto.webp");
    expect(out.byUrl.get(b)).toBe("foto-2.webp");
  });

  it("no hace nada con una lista vacía", async () => {
    const out = await bundleImages([], fakeStorage({}));
    expect(out.files).toEqual([]);
    expect(out.skipped).toBe(0);
  });
});
