import { describe, it, expect, vi } from "vitest";
import {
  selectOrphans,
  sweepUserImages,
  toBlobKey,
  deleteAllUserImages,
  DEFAULT_GRACE_MS,
} from "./image-sweep";
import type { ImageStorage, StoredBlob } from "./image-storage";

const NOW = new Date("2026-08-06T12:00:00Z").getTime();
const HOST = "https://abc.public.blob.vercel-storage.com/u/user-1";

function blob(name: string, ageMs: number, size = 1_000): StoredBlob {
  return { url: `${HOST}/${name}`, size, uploadedAt: new Date(NOW - ageMs) };
}

const DAYS = 24 * 60 * 60 * 1000;

describe("toBlobKey", () => {
  it("reduce la URL a su ruta en el store", () => {
    expect(toBlobKey(`${HOST}/foto.webp`)).toBe("/u/user-1/foto.webp");
  });

  it("ignora la query string", () => {
    expect(toBlobKey(`${HOST}/foto.webp?v=2`)).toBe(toBlobKey(`${HOST}/foto.webp`));
  });

  it("ignora el host", () => {
    expect(toBlobKey("https://otro.public.blob.vercel-storage.com/u/user-1/foto.webp")).toBe(
      toBlobKey(`${HOST}/foto.webp`),
    );
  });

  it("no revienta con algo que no es URL", () => {
    expect(toBlobKey("no-es-url")).toBe("no-es-url");
  });
});

describe("selectOrphans", () => {
  const opts = { now: NOW, graceMs: DEFAULT_GRACE_MS };

  it("reconoce como en uso una referencia que solo difiere en la query", () => {
    // El editor pudo guardar la URL con un parámetro que el listado no devuelve.
    const usada = blob("usada.webp", 10 * DAYS);
    const out = selectOrphans([usada], new Set([`${usada.url}?v=2`]), opts);

    expect(out.orphans).toEqual([]);
    expect(out.keptReferenced).toBe(1);
  });

  it("conserva lo que sigue referenciado, por viejo que sea", () => {
    const usada = blob("usada.webp", 400 * DAYS);
    const out = selectOrphans([usada], new Set([usada.url]), opts);

    expect(out.orphans).toEqual([]);
    expect(out.keptReferenced).toBe(1);
  });

  it("marca como huérfano lo que ya no referencia nadie", () => {
    const suelta = blob("suelta.webp", 10 * DAYS);
    const out = selectOrphans([suelta], new Set(), opts);

    expect(out.orphans).toEqual([suelta]);
    expect(out.keptRecent).toBe(0);
  });

  it("protege lo recién subido aunque no lo referencie nada todavía", () => {
    // El caso real: la imagen ya está en Blob pero el editor aún no ha guardado.
    const recien = blob("recien.webp", 5 * 60 * 1000);
    const out = selectOrphans([recien], new Set(), opts);

    expect(out.orphans).toEqual([]);
    expect(out.keptRecent).toBe(1);
  });

  it("la ventana de gracia se mide desde la subida", () => {
    const justoDentro = blob("dentro.webp", DEFAULT_GRACE_MS - 1);
    const justoFuera = blob("fuera.webp", DEFAULT_GRACE_MS + 1);
    const out = selectOrphans([justoDentro, justoFuera], new Set(), opts);

    expect(out.orphans).toEqual([justoFuera]);
    expect(out.keptRecent).toBe(1);
  });

  it("separa bien una mezcla", () => {
    const usada = blob("usada.webp", 10 * DAYS);
    const suelta = blob("suelta.webp", 10 * DAYS);
    const recien = blob("recien.webp", 60_000);
    const out = selectOrphans([usada, suelta, recien], new Set([usada.url]), opts);

    expect(out.orphans).toEqual([suelta]);
    expect(out.keptReferenced).toBe(1);
    expect(out.keptRecent).toBe(1);
  });
});

/** Store falso con paginación y borrado real sobre su propio estado. */
function fakeStorage(blobs: StoredBlob[], pageSize = 100) {
  const state = new Map(blobs.map((b) => [b.url, b]));
  const deleted: string[] = [];
  const listCalls: Array<string | undefined> = [];

  const storage: ImageStorage = {
    upload: vi.fn(),
    delete: vi.fn(),
    owns: (url) => url.startsWith(HOST),
    download: vi.fn(),
    list: async ({ cursor }) => {
      listCalls.push(cursor);
      const all = [...state.values()];
      const start = cursor ? Number(cursor) : 0;
      const slice = all.slice(start, start + pageSize);
      const next = start + pageSize;
      return { blobs: slice, cursor: next < all.length ? String(next) : undefined };
    },
    deleteMany: async (urls) => {
      for (const url of urls) {
        state.delete(url);
        deleted.push(url);
      }
    },
  };

  return { storage, deleted, state, listCalls };
}

describe("sweepUserImages", () => {
  const now = () => NOW;

  it("borra solo las huérfanas y deja intactas las que están en uso", async () => {
    const usada = blob("usada.webp", 10 * DAYS);
    const suelta = blob("suelta.webp", 10 * DAYS, 4_096);
    const { storage, deleted, state } = fakeStorage([usada, suelta]);

    const res = await sweepUserImages({
      userId: "user-1",
      storage,
      referenced: new Set([usada.url]),
      now,
    });

    expect(deleted).toEqual([suelta.url]);
    expect(state.has(usada.url)).toBe(true);
    expect(res).toMatchObject({
      scanned: 2,
      deleted: 1,
      freedBytes: 4_096,
      keptReferenced: 1,
      incomplete: false,
    });
  });

  it("no borra nada cuando todo está referenciado", async () => {
    const a = blob("a.webp", 10 * DAYS);
    const b = blob("b.webp", 10 * DAYS);
    const { storage, deleted } = fakeStorage([a, b]);

    const res = await sweepUserImages({
      userId: "user-1",
      storage,
      referenced: new Set([a.url, b.url]),
      now,
    });

    expect(deleted).toEqual([]);
    expect(res.deleted).toBe(0);
    expect(res.incomplete).toBe(false);
  });

  it("no borra nada con el store vacío", async () => {
    const { storage, deleted } = fakeStorage([]);
    const res = await sweepUserImages({ userId: "user-1", storage, referenced: new Set(), now });

    expect(deleted).toEqual([]);
    expect(res.scanned).toBe(0);
    expect(res.incomplete).toBe(false);
  });

  it("recorre todas las páginas del listado", async () => {
    const blobs = Array.from({ length: 25 }, (_, i) => blob(`x${i}.webp`, 10 * DAYS));
    const { storage, deleted, listCalls } = fakeStorage(blobs, 10);

    const res = await sweepUserImages({ userId: "user-1", storage, referenced: new Set(), now });

    expect(listCalls.length).toBe(3);
    expect(deleted).toHaveLength(25);
    expect(res.scanned).toBe(25);
    expect(res.incomplete).toBe(false);
  });

  it("respeta el tope de borrados y avisa de que quedó a medias", async () => {
    const blobs = Array.from({ length: 20 }, (_, i) => blob(`x${i}.webp`, 10 * DAYS));
    const { storage, deleted } = fakeStorage(blobs, 100);

    const res = await sweepUserImages({
      userId: "user-1",
      storage,
      referenced: new Set(),
      budget: { maxDeletes: 5 },
      now,
    });

    expect(deleted).toHaveLength(5);
    expect(res.deleted).toBe(5);
    expect(res.incomplete).toBe(true);
  });

  it("una segunda pasada termina lo que la primera dejó", async () => {
    const blobs = Array.from({ length: 8 }, (_, i) => blob(`x${i}.webp`, 10 * DAYS));
    const { storage, state } = fakeStorage(blobs, 100);
    const budget = { maxDeletes: 5 };

    const first = await sweepUserImages({ userId: "user-1", storage, referenced: new Set(), budget, now });
    expect(first.incomplete).toBe(true);

    const second = await sweepUserImages({ userId: "user-1", storage, referenced: new Set(), budget, now });
    expect(second.incomplete).toBe(false);
    expect(state.size).toBe(0);
  });

  it("para al agotarse el plazo y lo reporta", async () => {
    const blobs = Array.from({ length: 50 }, (_, i) => blob(`x${i}.webp`, 10 * DAYS));
    const { storage } = fakeStorage(blobs, 5);
    let tick = 0;
    const clock = () => (tick++) * 1_000;

    const res = await sweepUserImages({
      userId: "user-1",
      storage,
      referenced: new Set(),
      budget: { deadlineMs: 3_000 },
      now: clock,
    });

    expect(res.incomplete).toBe(true);
    expect(res.scanned).toBeLessThan(50);
  });

  it("lista por el prefijo del usuario y no por el store entero", async () => {
    const { storage } = fakeStorage([]);
    const spy = vi.spyOn(storage, "list");

    await sweepUserImages({ userId: "user-42", storage, referenced: new Set(), now });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ prefix: "u/user-42" }));
  });

  it("se niega a borrar si no reconoció ninguna imagen en uso", async () => {
    // La firma de una comparación rota: el usuario tiene imágenes de este store en
    // uso y el barrido las declara todas huérfanas. Sin freno, se las lleva todas.
    const blobs = Array.from({ length: 5 }, (_, i) => blob(`x${i}.webp`, 10 * DAYS));
    const { storage, deleted, state } = fakeStorage(blobs);

    const res = await sweepUserImages({
      userId: "user-1",
      storage,
      referenced: new Set([`${HOST}/otra-forma-de-url.webp`]),
      now,
    });

    expect(res.aborted).toBe(true);
    expect(res.deleted).toBe(0);
    expect(deleted).toEqual([]);
    expect(state.size).toBe(5);
  });

  it("no frena a quien solo usa imágenes por URL externa", async () => {
    // Cero coincidencias legítimas: sus referencias no son de este store.
    const suelta = blob("suelta.webp", 10 * DAYS);
    const { storage, deleted } = fakeStorage([suelta]);

    const res = await sweepUserImages({
      userId: "user-1",
      storage,
      referenced: new Set(["https://ajena.example/foto.png"]),
      now,
    });

    expect(res.aborted).toBe(false);
    expect(deleted).toEqual([suelta.url]);
  });

  it("no frena cuando el usuario no referencia ninguna imagen", async () => {
    const suelta = blob("suelta.webp", 10 * DAYS);
    const { storage, deleted } = fakeStorage([suelta]);

    const res = await sweepUserImages({ userId: "user-1", storage, referenced: new Set(), now });

    expect(res.aborted).toBe(false);
    expect(deleted).toEqual([suelta.url]);
  });

  it("no frena mientras reconozca al menos una en uso", async () => {
    const usada = blob("usada.webp", 10 * DAYS);
    const suelta = blob("suelta.webp", 10 * DAYS);
    const { storage, deleted } = fakeStorage([usada, suelta]);

    const res = await sweepUserImages({
      userId: "user-1",
      storage,
      referenced: new Set([usada.url]),
      now,
    });

    expect(res.aborted).toBe(false);
    expect(deleted).toEqual([suelta.url]);
  });

  it("agrupa los borrados en lotes en vez de uno por uno", async () => {
    const blobs = Array.from({ length: 250 }, (_, i) => blob(`x${i}.webp`, 10 * DAYS));
    const { storage } = fakeStorage(blobs, 250);
    const spy = vi.spyOn(storage, "deleteMany");

    await sweepUserImages({
      userId: "user-1",
      storage,
      referenced: new Set(),
      budget: { maxDeletes: 250 },
      now,
    });

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls.every((call) => call[0].length <= 100)).toBe(true);
  });
});

describe("deleteAllUserImages", () => {
  /** Store con páginas fijas: lo que se borra no mueve el cursor de la siguiente. */
  function pagedStorage(total: number, pageSize: number) {
    const all = Array.from({ length: total }, (_, i) => blob(`img-${i}.webp`, DAYS));
    const deleteMany = vi.fn<ImageStorage["deleteMany"]>(async () => {});
    const storage: ImageStorage = {
      upload: vi.fn(),
      delete: vi.fn(),
      owns: (url) => url.startsWith(HOST),
      download: vi.fn(),
      list: async ({ cursor }) => {
        const start = cursor ? Number(cursor) : 0;
        const next = start + pageSize;
        return { blobs: all.slice(start, next), cursor: next < all.length ? String(next) : undefined };
      },
      deleteMany,
    };
    return { storage, deleteMany, all };
  }

  it("recorre todas las páginas y borra en lotes", async () => {
    const { storage, deleteMany, all } = pagedStorage(250, 100);

    const deleted = await deleteAllUserImages(storage, "user-1");

    expect(deleted).toBe(250);
    expect(deleteMany).toHaveBeenCalledTimes(3);
    const borradas = deleteMany.mock.calls.flatMap(([urls]) => urls);
    expect(new Set(borradas)).toEqual(new Set(all.map((b) => b.url)));
  });

  it("con el store vacío no borra nada", async () => {
    const { storage, deleteMany } = pagedStorage(0, 100);

    expect(await deleteAllUserImages(storage, "user-1")).toBe(0);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
