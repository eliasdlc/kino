/**
 * Qué se prueba: el criterio de aceptación de que navegar entre dos páginas no
 * dispare ninguna escritura en Convex. La primera visita de un navegador
 * asegura la fila y deja su marca; con la marca puesta no se llama a Convex, y
 * un fallo al asegurar no corta el request ni deja una marca que mienta.
 */
import { describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { USER_ROW_COOKIE, ensureRowInConvex, ensureUserRow } from '@/shared/utils/user-row';

const CLERK_ID = 'user_ana';

function peticion(marca?: string, url = 'https://kino.test/dashboard') {
  const request = new NextRequest(url);
  if (marca !== undefined) request.cookies.set(USER_ROW_COOKIE, marca);
  return request;
}

describe('el suelo de la fila de usuario', () => {
  it('la asegura y deja la marca la primera vez', async () => {
    const asegurar = vi.fn().mockResolvedValue(undefined);
    const response = NextResponse.next();

    await ensureUserRow(peticion(), response, CLERK_ID, asegurar);

    expect(asegurar).toHaveBeenCalledOnce();
    expect(response.cookies.get(USER_ROW_COOKIE)?.value).toBe(CLERK_ID);
  });

  it('con la marca del mismo usuario no llama a Convex', async () => {
    const asegurar = vi.fn().mockResolvedValue(undefined);
    const response = NextResponse.next();

    await ensureUserRow(peticion(CLERK_ID), response, CLERK_ID, asegurar);

    expect(asegurar).not.toHaveBeenCalled();
    expect(response.cookies.get(USER_ROW_COOKIE)).toBeUndefined();
  });

  it('la marca de otra cuenta no vale para esta', async () => {
    const asegurar = vi.fn().mockResolvedValue(undefined);
    const response = NextResponse.next();

    await ensureUserRow(peticion('user_beto'), response, CLERK_ID, asegurar);

    expect(asegurar).toHaveBeenCalledOnce();
    expect(response.cookies.get(USER_ROW_COOKIE)?.value).toBe(CLERK_ID);
  });

  it('si asegurar falla no marca nada, para que el siguiente lo reintente', async () => {
    const asegurar = vi.fn().mockRejectedValue(new Error('convex caído'));
    const response = NextResponse.next();

    await expect(ensureUserRow(peticion(), response, CLERK_ID, asegurar)).resolves.toBeUndefined();

    expect(response.cookies.get(USER_ROW_COOKIE)).toBeUndefined();
  });

  it('sin token de la plantilla convex, asegurar lanza en vez de pasar de largo', async () => {
    await expect(ensureRowInConvex(async () => null)).rejects.toThrow(/plantilla/);
  });

  it('en http la marca no se manda como segura, o el navegador local la tiraría', async () => {
    const response = NextResponse.next();

    await ensureUserRow(peticion(undefined, 'http://localhost:3000/dashboard'), response, CLERK_ID, async () => {});

    expect(response.cookies.get(USER_ROW_COOKIE)?.secure).toBe(false);
  });
});
