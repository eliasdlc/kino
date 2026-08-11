import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptSecret,
  encryptSecret,
  EncryptionKeyError,
  isEncryptionConfigured,
} from "./crypto";

const KEY = randomBytes(32).toString("base64");
const OTRA_KEY = randomBytes(32).toString("base64");

let original: string | undefined;

beforeEach(() => {
  original = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = KEY;
});

afterEach(() => {
  if (original === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = original;
});

describe("encryptSecret / decryptSecret", () => {
  it("devuelve el secreto original", () => {
    const token = "gho_16C7e42F292c6912E7710c838347Ae178B4a";

    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it("admite unicode y cadenas vacías", () => {
    expect(decryptSecret(encryptSecret("año · ñandú · 日本"))).toBe(
      "año · ñandú · 日本",
    );
    expect(decryptSecret(encryptSecret(""))).toBe("");
  });

  // Sin IV aleatorio, dos usuarios con el mismo token tendrían el mismo
  // ciphertext y la tabla filtraría quién comparte credencial.
  it("cifra el mismo texto distinto cada vez", () => {
    const a = encryptSecret("mismo-token");
    const b = encryptSecret("mismo-token");

    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("guarda iv, tag y ciphertext separados", () => {
    expect(encryptSecret("x").split(".")).toHaveLength(3);
  });

  // Lo que aporta GCM sobre CBC: un ciphertext tocado no descifra a basura, falla.
  it("rechaza un ciphertext manipulado", () => {
    const [iv, tag, data] = encryptSecret("token-real").split(".");
    const alterado = Buffer.from(data, "base64url");
    alterado[0] ^= 0xff;

    expect(() =>
      decryptSecret([iv, tag, alterado.toString("base64url")].join(".")),
    ).toThrow();
  });

  it("rechaza un authTag manipulado", () => {
    const [iv, tag, data] = encryptSecret("token-real").split(".");
    const alterado = Buffer.from(tag, "base64url");
    alterado[0] ^= 0xff;

    expect(() =>
      decryptSecret([iv, alterado.toString("base64url"), data].join(".")),
    ).toThrow();
  });

  it("rechaza un secreto cifrado con otra clave", () => {
    const cifrado = encryptSecret("token-real");
    process.env.ENCRYPTION_KEY = OTRA_KEY;

    expect(() => decryptSecret(cifrado)).toThrow();
  });

  it.each(["", "sinpuntos", "solo.dos"])(
    "rechaza el formato inválido %j",
    (payload) => {
      expect(() => decryptSecret(payload)).toThrow(EncryptionKeyError);
    },
  );
});

describe("configuración de la clave", () => {
  it("falla con mensaje accionable si falta la variable", () => {
    delete process.env.ENCRYPTION_KEY;

    expect(() => encryptSecret("x")).toThrow(EncryptionKeyError);
    expect(() => encryptSecret("x")).toThrow(/openssl rand -base64 32/);
    expect(isEncryptionConfigured()).toBe(false);
  });

  it("falla si la clave no mide 32 bytes", () => {
    process.env.ENCRYPTION_KEY = randomBytes(16).toString("base64");

    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    expect(isEncryptionConfigured()).toBe(false);
  });

  it("reconoce una clave válida", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });
});
