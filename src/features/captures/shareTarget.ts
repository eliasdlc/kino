/**
 * El destino de compartir, y la cola que lo sostiene sin red.
 *
 * Por qué lo atiende el service worker y no una ruta: un destino de compartir
 * con método POST llega como una navegación de nivel superior cuyo iniciador es
 * la hoja del sistema, no Kino. La cookie de sesión de Clerk es `Lax` y no viaja
 * en un POST cross-site, así que el proxy no ve sesión y redirige a login, y un
 * 302 sobre un POST multipart pierde el cuerpo: la foto no llega nunca. El
 * worker intercepta el POST antes de la red, guarda lo compartido y responde con
 * un redirect a una ruta GET normal, que ya lleva su cookie.
 *
 * Lo que la cola guarda es un **registro**, no sólo el archivo: tipo, nombre,
 * tamaño y estado. La pantalla puede decir qué espera y por qué sin abrir un
 * blob de varios MB, y el archivo se queda donde el navegador lo dejó con el
 * almacenamiento persistente pedido, en vez de vivir bajo un tope de bytes con
 * desalojo del más viejo: un borrado que nadie pidió es justo lo que la frase
 * "nunca se archiva en silencio" promete que no pasa.
 */

export const COLA_DB = "kino-capturas";
export const COLA_STORE = "pendientes";
export const DUENO_STORE = "dueno";
export const COLA_VERSION = 1;

/** Los cuatro tipos que la hoja de compartir puede mandar. Espejo de `captureKind`. */
export type ShareKind = "text" | "link" | "photo" | "voice";

/** En qué punto del viaje está lo compartido. */
export type EstadoRegistro = "pendiente" | "subiendo" | "subida";

/**
 * Una cosa compartida, entre que llega al teléfono y que existe en Convex.
 * Vive en IndexedDB porque el POST de la hoja no puede llegar al servidor.
 */
export interface RegistroCompartido {
  id: string;
  /**
   * Quién tenía la sesión abierta en este navegador cuando llegó. Es lo que
   * impide que dos cuentas en el mismo teléfono se vean la cola: sin dueño
   * conocido el registro no se le enseña a nadie.
   */
  ownerId: string | null;
  kind: ShareKind;
  /** El nombre del archivo, cuando lo hay. */
  name: string | null;
  /** Bytes del archivo. Cero para texto y enlace, que no tienen. */
  size: number;
  text: string | null;
  url: string | null;
  receivedAt: number;
  estado: EstadoRegistro;
  /** El archivo tal cual llegó. Sólo lo lee quien va a subirlo. */
  blob: Blob | null;
}

/** Lo que el handler necesita del mundo, para poder probarlo sin navegador. */
export interface DepsCompartir {
  guardar: (registro: RegistroCompartido) => Promise<void>;
  /** El dueño de la sesión abierta en este navegador, si el app lo dejó escrito. */
  duenoActual: () => Promise<string | null>;
  nuevoId: () => string;
  ahora: () => number;
}

const CAMPOS_ARCHIVO = ["imagen", "audio", "archivo"] as const;

/** Un enlace suelto se distingue de un texto por ser una URL entera y sola. */
export function pareceEnlace(valor: string): boolean {
  const limpio = valor.trim();
  if (limpio.length === 0 || /\s/.test(limpio)) return false;
  try {
    const { protocol } = new URL(limpio);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** El tipo de un archivo compartido, por su MIME. */
function kindDeArchivo(file: File): ShareKind {
  if (file.type.startsWith("audio/")) return "voice";
  return "photo";
}

/**
 * El registro que sale de lo que la hoja de compartir mandó. El primer archivo
 * manda sobre el texto: compartir una foto con su nombre no es compartir texto.
 */
export function registroDesdeFormData(
  form: FormData,
  deps: Pick<DepsCompartir, "nuevoId" | "ahora">,
  ownerId: string | null,
): RegistroCompartido {
  const base = {
    id: deps.nuevoId(),
    ownerId,
    receivedAt: deps.ahora(),
    estado: "pendiente" as const,
  };

  for (const campo of CAMPOS_ARCHIVO) {
    const valor = form.get(campo);
    if (valor instanceof File && valor.size > 0) {
      return {
        ...base,
        kind: kindDeArchivo(valor),
        name: valor.name || null,
        size: valor.size,
        text: null,
        url: null,
        blob: valor,
      };
    }
  }

  const url = typeof form.get("url") === "string" ? String(form.get("url")).trim() : "";
  const texto = typeof form.get("texto") === "string" ? String(form.get("texto")).trim() : "";
  const titulo = typeof form.get("titulo") === "string" ? String(form.get("titulo")).trim() : "";

  // Android manda el enlace dentro de `text` la mitad de las veces, así que el
  // enlace se reconoce por su forma y no por el campo en el que vino.
  const enlace = url || (pareceEnlace(texto) ? texto : "");
  if (enlace) {
    return { ...base, kind: "link", name: titulo || null, size: 0, text: null, url: enlace, blob: null };
  }

  return {
    ...base,
    kind: "text",
    name: titulo || null,
    size: 0,
    text: texto || titulo || null,
    url: null,
    blob: null,
  };
}

/**
 * Atiende el POST de la hoja de compartir: guarda lo que llegó y devuelve el
 * redirect a la ruta GET. No toca la red, así que compartir sin cobertura
 * funciona igual y es lo que hace que capturar en la calle valga algo.
 */
export async function atenderCompartido(request: Request, deps: DepsCompartir): Promise<Response> {
  const form = await request.formData();
  const ownerId = await deps.duenoActual();
  const registro = registroDesdeFormData(form, deps, ownerId);
  await deps.guardar(registro);

  // 303 y no 302: obliga al navegador a rehacer la petición como GET, que es
  // exactamente lo que hace falta para que la cookie de sesión viaje.
  return new Response(null, {
    status: 303,
    headers: { Location: `/compartir?recibo=${encodeURIComponent(registro.id)}` },
  });
}

/** Lo que se le enseña a una sesión: lo suyo, y lo que llegó sin dueño conocido. */
export function registrosDe(cola: readonly RegistroCompartido[], ownerId: string): RegistroCompartido[] {
  return cola.filter((registro) => registro.ownerId === ownerId);
}

/** Lo que queda en la cola cuando una sesión se cierra: todo lo que no era suyo. */
export function colaSinDueno(
  cola: readonly RegistroCompartido[],
  ownerId: string,
): RegistroCompartido[] {
  return cola.filter((registro) => registro.ownerId !== ownerId);
}

// ── La cola en IndexedDB ───────────────────────────────────────────────────
//
// Es el único sitio donde el navegador deja guardar un archivo que llegó por un
// POST que nadie puede reenviar todavía. Lo de arriba es lógica pura y se prueba
// sola; esto es el adaptador, y lo ejercita el teléfono.

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(COLA_DB, COLA_VERSION);
    peticion.onupgradeneeded = () => {
      const db = peticion.result;
      if (!db.objectStoreNames.contains(COLA_STORE)) db.createObjectStore(COLA_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(DUENO_STORE)) db.createObjectStore(DUENO_STORE);
    };
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

function esperar<T>(peticion: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

/** Guarda un registro recién llegado. */
export async function guardarEnCola(registro: RegistroCompartido): Promise<void> {
  const db = await abrir();
  await esperar(db.transaction(COLA_STORE, "readwrite").objectStore(COLA_STORE).put(registro));
  db.close();
}

/** Todo lo que hay en la cola, sin filtrar. */
export async function leerCola(): Promise<RegistroCompartido[]> {
  const db = await abrir();
  const todo = await esperar(
    db.transaction(COLA_STORE, "readonly").objectStore(COLA_STORE).getAll() as IDBRequest<RegistroCompartido[]>,
  );
  db.close();
  return todo;
}

/** Saca un registro de la cola, porque ya existe en Convex o porque se descartó. */
export async function borrarDeCola(id: string): Promise<void> {
  const db = await abrir();
  await esperar(db.transaction(COLA_STORE, "readwrite").objectStore(COLA_STORE).delete(id));
  db.close();
}

/**
 * Vacía lo que era de una sesión que se cierra. Lo de otras cuentas del mismo
 * navegador se queda donde está: la cola está acotada por dueño, no por
 * dispositivo.
 */
export async function vaciarColaDe(ownerId: string): Promise<void> {
  const db = await abrir();
  const store = db.transaction(COLA_STORE, "readwrite").objectStore(COLA_STORE);
  const todo = await esperar(store.getAll() as IDBRequest<RegistroCompartido[]>);
  for (const registro of todo) {
    if (registro.ownerId === ownerId) store.delete(registro.id);
  }
  db.close();
}

/**
 * Deja escrito quién tiene la sesión abierta, para que el worker pueda ponerle
 * dueño a lo que llegue. El worker no tiene sesión y no puede preguntárselo a
 * nadie: o lo encuentra escrito o el registro nace sin dueño y no se le enseña
 * a ninguna cuenta.
 */
export async function recordarDueno(ownerId: string | null): Promise<void> {
  const db = await abrir();
  const store = db.transaction(DUENO_STORE, "readwrite").objectStore(DUENO_STORE);
  if (ownerId === null) store.delete("actual");
  else store.put(ownerId, "actual");
  db.close();
}

/** Quién tenía la sesión abierta la última vez que la app lo escribió. */
export async function leerDueno(): Promise<string | null> {
  const db = await abrir();
  const valor = await esperar(
    db.transaction(DUENO_STORE, "readonly").objectStore(DUENO_STORE).get("actual") as IDBRequest<string | undefined>,
  );
  db.close();
  return valor ?? null;
}

/**
 * Le pide al navegador que no desaloje lo guardado. Sin esto, el archivo que
 * espera red es lo primero que se va cuando el disco aprieta, y desaparecería
 * en silencio. Devuelve si el permiso quedó concedido.
 */
export async function pedirAlmacenamientoPersistente(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
