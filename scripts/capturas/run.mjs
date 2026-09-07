#!/usr/bin/env node
/**
 * Captura las pantallas de Kino sin tocar la pantalla de nadie.
 *
 * Recorre las 19 rutas de `src/app` con la cuenta sembrada, más el catálogo y guarda una
 * captura por ruta, viewport y tema. Usa el `playwright` instalado en la
 * laptop (no es dependencia del repo) contra un `pnpm dev` que ya corre.
 *
 *   pnpm dev                                  # en otra terminal
 *   node scripts/capturas/run.mjs             # 20 rutas x 4 viewports x 2 temas
 *   node scripts/capturas/run.mjs dashboard   # sólo las rutas cuyo nombre contenga "dashboard"
 *
 * Entorno:
 *   CLERK_SECRET_KEY    de `~/.config/secretos/kino.env`; si no está en el
 *                       entorno el script lee ese fichero él mismo.
 *   KINO_URL            base del servidor, por defecto http://localhost:3000
 *   KINO_CUENTA         correo de la cuenta sembrada, por defecto prueba@usekino.dev
 *   KINO_CUENTA_ONBOARDING
 *                       una cuenta que no completó el onboarding, por defecto
 *                       onboarding@usekino.dev; con ella se captura /onboarding
 *   KINO_CAPTURAS_DIR   salida, por defecto ~/Documents/Kino/dev/auditorias/<fecha>-capturas
 *   KINO_SYSTEM_ID, KINO_FOLDER_ID, KINO_PAGE_ID
 *                       ids a capturar; si faltan se toman del primer sistema
 *                       de la cuenta que tenga carpeta y página.
 *
 * La sesión entra con un sign-in token de Clerk (`POST /v1/sign_in_tokens`),
 * nunca con el formulario: headless aterriza en la pantalla de client-trust.
 * El tema se fija como lo hace la app, con `kino-theme` en localStorage,
 * antes de la primera pintura.
 */

import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);

function cargarPlaywright() {
  try {
    return require("playwright");
  } catch {
    const bin = execSync("which playwright", { encoding: "utf8" }).trim();
    const raiz = bin.replace(/\/node_modules\/\.bin\/playwright$/, "");
    return require(join(raiz, "node_modules", "playwright"));
  }
}

async function cargarSecreto(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  const ruta = join(homedir(), ".config", "secretos", "kino.env");
  if (!existsSync(ruta)) throw new Error(`Falta ${nombre} y no existe ${ruta}`);
  const linea = (await readFile(ruta, "utf8"))
    .split("\n")
    .find((l) => l.startsWith(`${nombre}=`));
  if (!linea) throw new Error(`Falta ${nombre} en ${ruta}`);
  return linea.slice(nombre.length + 1).replace(/^"|"$/g, "");
}

const BASE = process.env.KINO_URL ?? "http://localhost:3000";
const CUENTA = process.env.KINO_CUENTA ?? "prueba@usekino.dev";
const CUENTA_ONBOARDING = process.env.KINO_CUENTA_ONBOARDING ?? "onboarding@usekino.dev";
const FECHA = new Date().toISOString().slice(0, 10);
const SALIDA =
  process.env.KINO_CAPTURAS_DIR ??
  join(homedir(), "Documents", "Kino", "dev", "auditorias", `${FECHA}-capturas`);
const FILTRO = process.argv[2];

/** Los cuatro viewports que Elias usa de verdad. */
const VIEWPORTS = [
  { width: 393, height: 852, movil: true },
  { width: 430, height: 748, movil: true },
  { width: 1131, height: 686, movil: false },
  { width: 1440, height: 900, movil: false },
];
const TEMAS = ["light", "dark"];

/** Las 19 rutas de `src/app` más `/system-design`, con el nombre del fichero de salida. */
function rutas(ids) {
  const s = `/systems/${ids.systemId}`;
  const f = `${s}/folders/${ids.folderId}`;
  return [
    { nombre: "dashboard", url: "/dashboard" },
    { nombre: "tasks", url: "/tasks" },
    { nombre: "calendar", url: "/calendar" },
    { nombre: "systems", url: "/systems" },
    { nombre: "system", url: s },
    { nombre: "system-codex", url: `${s}/codex` },
    { nombre: "system-estudio", url: `${s}/estudio` },
    { nombre: "folder", url: f },
    { nombre: "folder-lectura", url: `${f}/lectura` },
    { nombre: "folder-tablero", url: `${f}/tablero` },
    { nombre: "page", url: `${s}/pages/${ids.pageId}` },
    { nombre: "settings", url: "/settings" },
    { nombre: "onboarding", url: "/onboarding", onboarding: true },
    { nombre: "login", url: "/login", anonima: true },
    { nombre: "register", url: "/register", anonima: true },
    { nombre: "landing", url: "/", anonima: true },
    { nombre: "docs", url: "/docs", anonima: true },
    { nombre: "para-estudiantes", url: "/para/estudiantes", anonima: true },
    { nombre: "offline", url: "/offline", anonima: true },
    { nombre: "system-design", url: "/system-design", anonima: true },
  ];
}

async function clerk(ruta, secreto, init = {}) {
  const res = await fetch(`https://api.clerk.com/v1${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${secreto}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Clerk ${ruta}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ticketDeSesion(secreto, cuenta = CUENTA) {
  const usuarios = await clerk(`/users?email_address=${encodeURIComponent(cuenta)}`, secreto);
  if (usuarios.length !== 1) throw new Error(`Clerk devolvió ${usuarios.length} usuarios para ${cuenta}`);
  const token = await clerk("/sign_in_tokens", secreto, {
    method: "POST",
    body: JSON.stringify({ user_id: usuarios[0].id, expires_in_seconds: 600 }),
  });
  return token.token;
}

async function iniciarSesion(context, ticket) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, { timeout: 30_000 });
  await page.evaluate(async (t) => {
    const res = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: t });
    if (res.status !== "complete") throw new Error(`signIn ${res.status}`);
    await window.Clerk.setActive({ session: res.createdSessionId });
  }, ticket);
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, { timeout: 15_000 });
  await page.close();
}

/** Primer sistema con carpeta y página, leído de los enlaces de la app. */
async function resolverIds(context) {
  const ids = {
    systemId: process.env.KINO_SYSTEM_ID,
    folderId: process.env.KINO_FOLDER_ID,
    pageId: process.env.KINO_PAGE_ID,
  };
  if (ids.systemId && ids.folderId && ids.pageId) return ids;
  const page = await context.newPage();
  const hrefs = async (patron) => {
    const todos = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    return [...new Set(todos.map((h) => h?.match(patron)?.[1]).filter(Boolean))];
  };
  await page.goto(`${BASE}/systems`, { waitUntil: "networkidle" });
  const sistemas = await hrefs(/^\/systems\/([a-z0-9]+)$/);
  if (sistemas.length === 0) throw new Error("La cuenta no tiene sistemas");
  for (const systemId of sistemas) {
    await page.goto(`${BASE}/systems/${systemId}`, { waitUntil: "networkidle" });
    const carpetas = await hrefs(/\/folders\/([a-z0-9]+)/);
    const paginas = await hrefs(/\/pages\/([a-z0-9]+)/);
    if (carpetas.length && paginas.length) {
      await page.close();
      return { systemId, folderId: carpetas[0], pageId: paginas[0] };
    }
  }
  await page.close();
  throw new Error(`Ningún sistema de ${sistemas.length} tiene carpeta y página; pasa KINO_SYSTEM_ID, KINO_FOLDER_ID y KINO_PAGE_ID`);
}

async function capturar(browser, storageState, ids, storageOnboarding) {
  await mkdir(SALIDA, { recursive: true });
  const lista = rutas(ids).filter((r) => !FILTRO || r.nombre.includes(FILTRO));
  let hechas = 0;
  const fallos = [];
  for (const tema of TEMAS) {
    for (const vp of VIEWPORTS) {
      const contextos = {
        sesion: await browser.newContext({
          storageState,
          viewport: vp,
          isMobile: vp.movil,
          hasTouch: vp.movil,
          deviceScaleFactor: 2,
          colorScheme: tema,
          reducedMotion: "reduce",
        }),
        anonimo: await browser.newContext({
          viewport: vp,
          isMobile: vp.movil,
          hasTouch: vp.movil,
          deviceScaleFactor: 2,
          colorScheme: tema,
          reducedMotion: "reduce",
        }),
        onboarding: await browser.newContext({
          storageState: storageOnboarding ?? storageState,
          viewport: vp,
          isMobile: vp.movil,
          hasTouch: vp.movil,
          deviceScaleFactor: 2,
          colorScheme: tema,
          reducedMotion: "reduce",
        }),
      };
      for (const ctx of Object.values(contextos)) {
        await ctx.addInitScript((t) => localStorage.setItem("kino-theme", t), tema);
      }
      for (const ruta of lista) {
        const ctx = ruta.anonima ? contextos.anonimo : ruta.onboarding ? contextos.onboarding : contextos.sesion;
        const page = await ctx.newPage();
        const fichero = join(SALIDA, `${ruta.nombre}-${vp.width}x${vp.height}-${tema}.png`);
        try {
          const res = await page.goto(`${BASE}${ruta.url}`, { waitUntil: "networkidle", timeout: 60_000 });
          // Los datos de Convex llegan por websocket después de networkidle.
          await page.waitForTimeout(2500);
          await page.evaluate(() => document.fonts.ready);
          // Un autofocus (la paleta de comandos del catálogo) desplaza la página; la captura es del inicio.
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
          const final = new URL(page.url()).pathname;
          const status = res?.status();
          if (status && status >= 500) throw new Error(`HTTP ${status}`);
          if (!ruta.anonima && final.startsWith("/login")) throw new Error("aterrizó en /login: la sesión no entró");
          if (await page.getByText("Esta vista tuvo un problema").count()) throw new Error("renderizó el error boundary");
          await page.screenshot({ path: fichero });
          hechas++;
          if (final !== ruta.url) console.log(`  ${ruta.nombre}: ${ruta.url} → ${final}`);
        } catch (e) {
          fallos.push(`${ruta.nombre} ${vp.width}x${vp.height} ${tema}: ${e.message.split("\n")[0]}`);
        } finally {
          await page.close();
        }
      }
      await contextos.sesion.close();
      await contextos.anonimo.close();
      await contextos.onboarding.close();
      console.log(`${tema} ${vp.width}x${vp.height}: ${hechas} capturas acumuladas`);
    }
  }
  return { hechas, fallos };
}

/** El Chromium que Playwright descargó, o el del sistema si no lo tiene. */
async function lanzar(chromium) {
  const sistema = process.env.KINO_CHROMIUM ?? "/usr/bin/chromium";
  try {
    return await chromium.launch();
  } catch (e) {
    if (!existsSync(sistema)) throw e;
    return chromium.launch({ executablePath: sistema });
  }
}

async function main() {
  const { chromium } = cargarPlaywright();
  const secreto = await cargarSecreto("CLERK_SECRET_KEY");
  const alive = await fetch(BASE).catch(() => null);
  if (!alive) throw new Error(`${BASE} no responde: arranca pnpm dev primero`);

  const browser = await lanzar(chromium);
  try {
    const ticket = await ticketDeSesion(secreto);
    const login = await browser.newContext({ viewport: VIEWPORTS[3] });
    await iniciarSesion(login, ticket);
    const ids = await resolverIds(login);
    const storageState = await login.storageState();
    await login.close();

    // La cuenta sin onboarding, si existe: sin ella /onboarding redirige a Hoy.
    let storageOnboarding = null;
    try {
      const ticket2 = await ticketDeSesion(secreto, CUENTA_ONBOARDING);
      const login2 = await browser.newContext({ viewport: VIEWPORTS[3] });
      await iniciarSesion(login2, ticket2);
      storageOnboarding = await login2.storageState();
      await login2.close();
    } catch (e) {
      console.log(`Sin cuenta de onboarding (${e.message.split("\n")[0]}); /onboarding se captura con la principal.`);
    }
    console.log(`Sesión de ${CUENTA}. Sistema ${ids.systemId}, carpeta ${ids.folderId}, página ${ids.pageId}`);
    console.log(`Salida: ${SALIDA}`);

    const { hechas, fallos } = await capturar(browser, storageState, ids, storageOnboarding);
    console.log(`\n${hechas} capturas en ${SALIDA}`);
    if (fallos.length) {
      console.log(`${fallos.length} fallos:`);
      for (const f of fallos) console.log(`  ${f}`);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
