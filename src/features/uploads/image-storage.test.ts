import { describe, it, expect } from "vitest";
import { isVercelBlobUrl } from "./image-storage";

describe("isVercelBlobUrl", () => {
  it("acepta una URL real del store", () => {
    expect(
      isVercelBlobUrl("https://abc123.public.blob.vercel-storage.com/u/user-1/foto.webp"),
    ).toBe(true);
  });

  it("rechaza hosts ajenos", () => {
    expect(isVercelBlobUrl("https://ajena.example/foto.png")).toBe(false);
    expect(isVercelBlobUrl("https://vercel-storage.com/foto.png")).toBe(false);
  });

  it("rechaza el host que solo termina parecido", () => {
    // Sin el punto del sufijo, este dominio de un atacante pasaría el filtro.
    expect(isVercelBlobUrl("https://evilblob.vercel-storage.com/x.png")).toBe(false);
  });

  it("rechaza el sufijo puesto en la ruta o en la query", () => {
    expect(isVercelBlobUrl("https://evil.example/.blob.vercel-storage.com/x.png")).toBe(false);
    expect(isVercelBlobUrl("https://evil.example/?x=.blob.vercel-storage.com")).toBe(false);
  });

  it("rechaza esquemas que no son https", () => {
    expect(isVercelBlobUrl("http://abc.public.blob.vercel-storage.com/x.png")).toBe(false);
    expect(isVercelBlobUrl("file:///etc/passwd")).toBe(false);
    expect(isVercelBlobUrl("data:image/png;base64,AAAA")).toBe(false);
  });

  it("rechaza objetivos internos típicos de SSRF", () => {
    expect(isVercelBlobUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isVercelBlobUrl("http://localhost:3000/api/admin")).toBe(false);
  });

  it("rechaza lo que no es una URL", () => {
    expect(isVercelBlobUrl("")).toBe(false);
    expect(isVercelBlobUrl("/relativa/foto.png")).toBe(false);
    expect(isVercelBlobUrl("no es una url")).toBe(false);
  });

  it("no distingue mayúsculas en el host", () => {
    expect(isVercelBlobUrl("https://ABC.public.BLOB.VERCEL-STORAGE.COM/x.png")).toBe(true);
  });
});
