"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { ConvexError } from "convex/values";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePage, useUpdatePage } from "./pages.hooks";
import { useSharedEditor } from "./EditorContext";
import { TableMenus } from "./TableMenus";
import { CodexChips } from "@/features/entities/CodexChips";
import { CodexSelectionActions } from "./CodexBubbleMenu";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import { StickyNoteCreator } from "@/features/sticky-notes/StickyNoteCreator";
import type { PageDetailTransport } from "./pages.types";

interface NotebookEditorProps {
  page: PageDetailTransport;
  systemId: string;
  pageId?: string;
  /** Arquetipo Writing: activa la tipografía serif de lectura (PLAN-11 §7). */
  writer?: boolean;
  /**
   * El título vive en el layout, no aquí: de él cuelgan las migas, el nombre de
   * la sesión de escritura y el del archivo exportado, y todos tienen que
   * cambiar mientras se escribe.
   */
  title: string;
  onTitleChange: (title: string) => void;
}

/** El título guarda solo y rápido: seguir escribiendo el cuerpo no lo retrasa. */
const TITLE_SAVE_MS = 400;
const CONTENT_SAVE_MS = 1500;

/** Lo que el editor manda en un guardado. `null` en el título lo vacía. */
type PagePatch = { title?: string | null; content?: string };

/** El servidor rechazó el guardado porque la página cambió después de leerla. */
function esConflicto(error: Error): boolean {
  if (!(error instanceof ConvexError)) return false;
  const data: unknown = error.data;
  return typeof data === "object" && data !== null && "code" in data && data.code === "CONFLICT";
}

export function NotebookEditor({ page, systemId, pageId, writer = false, title, onTitleChange }: NotebookEditorProps) {
  const editor = useSharedEditor();
  const { mutate: updatePage } = useUpdatePage(page.id, systemId);
  // El texto también cambia fuera de esta pantalla: restaurar una versión,
  // mover una escena en la rejilla, otra pestaña, el conector MCP. La
  // suscripción es lo único que hace que el editor se entere.
  const { data: servidor } = usePage(page.id, page);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stickyCreator, setStickyCreator] = useState<{
    text: string | null;
    selectionAnchor: { anchorId: string; from: number; to: number } | null;
    screen: { x: number; y: number };
  } | null>(null);
  const [mentionEntityId, setMentionEntityId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Lo tecleado que el temporizador todavía no ha dado por vencido. */
  const pendingPatch = useRef<PagePatch | null>(null);
  /** Lo vencido que espera turno: sólo sale un guardado a la vez. */
  const enCola = useRef<PagePatch | null>(null);
  /** Hay un guardado esperando respuesta del servidor. */
  const enVuelo = useRef(false);
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  /** Mientras es `false` ya no hay pantalla donde recargar nada. */
  const montado = useRef(true);
  /**
   * La versión del servidor sobre la que está escrito lo que hay en pantalla.
   * Viaja en cada guardado: si el servidor ya tiene otra, la escritura se
   * rechaza con CONFLICT en vez de pisar lo que guardó el otro lado.
   */
  const sincronizadoEn = useRef(page.updatedAt);
  const servidorRef = useRef(servidor);
  useEffect(() => {
    servidorRef.current = servidor;
  }, [servidor]);
  /**
   * El cambio que hay en curso viene del servidor. El documento sí avisa de que
   * cambió, para que el índice, los resaltados y el carril se rehagan; lo único
   * que no ocurre es devolverle al servidor el texto que acaba de mandar.
   */
  const aplicandoDelServidor = useRef(false);

  // Click en una mención del codex → abre su ficha (referencia a un click sin
  // salir del texto, PLAN-11 §8.3). Solo en editores de escritura.
  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!writer) return;
    const mention = (e.target as HTMLElement).closest<HTMLElement>(".codex-mention");
    const id = mention?.getAttribute("data-entity-id");
    if (id) {
      e.preventDefault();
      setMentionEntityId(id);
    }
  }

  /**
   * Trae a la pantalla lo que el servidor tiene, y se queda con su versión.
   *
   * El cuerpo y el título se miran por separado a propósito: `setContent`
   * reemplaza el documento entero y el cursor acaba al final, así que hacerlo
   * con un cuerpo idéntico porque cambió el título (renombrar el cuaderno desde
   * otra pestaña) sacaría a alguien de donde está escribiendo sin que su texto
   * haya cambiado. Lo que estorba es que el cursor se mueva, no adónde va: en
   * mitad de un párrafo, saltar al final es tan malo como saltar al principio.
   */
  const recargar = useCallback(
    (delServidor: PageDetailTransport) => {
      if (!editor || editor.isDestroyed) return;
      const contenido = delServidor.content ?? "";
      const tituloDelServidor = delServidor.title ?? "";
      sincronizadoEn.current = delServidor.updatedAt;
      const cuerpoCambio = editor.getHTML() !== contenido;
      const tituloCambio = tituloDelServidor !== titleRef.current;

      if (tituloCambio) {
        if (titleTimer.current) {
          clearTimeout(titleTimer.current);
          titleTimer.current = null;
        }
        onTitleChange(tituloDelServidor);
      }
      if (!cuerpoCambio) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      pendingPatch.current = null;
      aplicandoDelServidor.current = true;
      try {
        editor.commands.setContent(contenido);
      } finally {
        aplicandoDelServidor.current = false;
      }
    },
    [editor, onTitleChange]
  );

  const enviarRef = useRef<() => void>(() => {});

  /**
   * Manda lo que espera turno, de uno en uno.
   *
   * Serializar no es una precaución contra el otro lado: es que el
   * `expectedUpdatedAt` del segundo guardado tiene que ser el `updatedAt` que
   * devolvió el primero. El cuerpo y el título tienen temporizadores distintos
   * y el cierre del capítulo manda lo que quede, así que salían dos escrituras
   * con la misma versión; la primera la movía y la segunda chocaba contra el
   * propio editor. El título, que es el que suele ir detrás, se perdía sin que
   * nadie lo viera.
   */
  const enviar = useCallback(() => {
    if (enVuelo.current) return;
    const patch = enCola.current;
    enCola.current = null;
    if (!patch) return;
    enVuelo.current = true;
    // El turno se suelta una vez y pase lo que pase: si el manejador del error
    // lanzara, `onSettled` no correría y la cola se quedaría parada para
    // siempre, sin guardar nada más hasta recargar la página.
    let soltado = false;
    const soltarTurno = () => {
      if (soltado) return;
      soltado = true;
      enVuelo.current = false;
      enviarRef.current();
    };
    updatePage(
      { ...patch, expectedUpdatedAt: sincronizadoEn.current },
      {
        onSuccess: (guardado) => {
          sincronizadoEn.current = guardado.updatedAt;
        },
        onError: (error) => {
          try {
            // Aquí el choque sí es de fuera: manda lo que hay en el servidor y
            // lo que quedaba por escribir no lo pisa. Si la suscripción todavía
            // no ha traído esa versión, el efecto de abajo recarga al llegar.
            if (!esConflicto(error)) return;
            enCola.current = null;
            pendingPatch.current = null;
            const delServidor = servidorRef.current;
            if (montado.current && delServidor) {
              recargar(delServidor);
              return;
            }
            // Sin pantalla donde recargar no hay nada que hacer con el texto, y
            // callarlo es cómo se perdía antes.
            toast.error("Lo último que escribiste no se guardó: la página cambió en otro sitio.");
          } finally {
            soltarTurno();
          }
        },
        onSettled: soltarTurno,
      }
    );
  }, [updatePage, recargar]);

  useEffect(() => {
    enviarRef.current = enviar;
  }, [enviar]);

  const guardar = useCallback(
    (patch: PagePatch) => {
      enCola.current = { ...enCola.current, ...patch };
      enviar();
    },
    [enviar]
  );

  const scheduleSave = useCallback(
    (patch: PagePatch) => {
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        const pending = pendingPatch.current;
        pendingPatch.current = null;
        if (pending) guardar(pending);
      }, CONTENT_SAVE_MS);
    },
    [guardar]
  );

  // Cuando el servidor tiene otra versión, la pantalla la trae. Es la otra
  // mitad del `expectedUpdatedAt`: sin esto, una versión restaurada la deshacía
  // la siguiente tecla y dos pestañas se pisaban con el documento entero.
  useEffect(() => {
    if (!editor || !servidor || servidor.updatedAt === sincronizadoEn.current) return;
    // Un guardado propio sin salir, esperando turno o en vuelo manda: su
    // respuesta trae la versión buena, y si llega tarde choca y recarga ahí.
    if (pendingPatch.current !== null || enCola.current !== null || enVuelo.current) return;
    recargar(servidor);
  }, [editor, servidor, recargar]);

  // Subscribe to editor updates for autosave
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (aplicandoDelServidor.current) return;
      scheduleSave({ content: editor.getHTML() });
    };
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [editor, scheduleSave]);

  // Lo pendiente se guarda al desmontar, y sólo al desmontar: un efecto que
  // dependiera de `guardar` correría su limpieza en cada render y volvería a
  // mandar el mismo parche en bucle. Por eso la función se lee por ref.
  const guardarRef = useRef(guardar);
  useEffect(() => {
    guardarRef.current = guardar;
  }, [guardar]);
  useEffect(() => {
    // Se pone al entrar, no sólo al salir: en desarrollo StrictMode monta,
    // desmonta y vuelve a montar, y un `montado` que sólo sabe bajar dejaba el
    // editor vivo creyéndose muerto, sin recargar nunca y sin guardar nada.
    montado.current = true;
    return () => {
      montado.current = false;
      // El cuerpo y el título salen en un solo guardado. Dos, aunque la cola
      // los ordenara, serían dos viajes para el mismo gesto de cerrar.
      const ultimo: PagePatch = { ...pendingPatch.current };
      pendingPatch.current = null;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      // Un título escrito y una salida inmediata no pueden perderse.
      if (titleTimer.current) {
        clearTimeout(titleTimer.current);
        titleTimer.current = null;
        ultimo.title = titleRef.current || null;
      }
      if (Object.keys(ultimo).length > 0) guardarRef.current(ultimo);
    };
  }, []);

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    onTitleChange(next);
    // Temporizador propio: el del cuerpo se reinicia con cada tecla, así que
    // seguir escribiendo podía retrasar el guardado del título sin límite.
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      titleTimer.current = null;
      // Vaciar el título lo deja vacío: `null` lo borra y `undefined` sería no
      // tocarlo, que es lo que antes hacía imposible quitarlo desde la interfaz.
      guardar({ title: next || null });
    }, TITLE_SAVE_MS);
  }

  function handleCreateSticky() {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const text = empty ? "" : editor.state.doc.textBetween(from, to, " ");

    // El rango viaja al creador y la marca se escribe al guardar, nunca al
    // abrir: cancelar no puede dejar anotada una frase cuya nota no existe.
    const selectionAnchor = empty ? null : { anchorId: crypto.randomUUID(), from, to };

    // Abrir el popover junto al final de la selección.
    const coords = editor.view.coordsAtPos(to);
    setStickyCreator({
      text: text || null,
      selectionAnchor,
      screen: { x: coords.right, y: coords.bottom },
    });
  }

  const resolvedPageId = pageId ?? page.id;

  return (
    <>
      <div className="flex flex-col gap-4 h-full">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Sin título"
          className="w-full bg-transparent text-3xl font-bold placeholder:text-muted-foreground/40 focus:outline-none border-none p-0"
          maxLength={500}
        />
        {/* El codex a un toque mientras escribes. En escritorio no: ahí el rail
            del panel derecho ya lo cubre y esta fila sería una segunda forma de
            hacer lo mismo. */}
        {writer && (
          <div className="md:hidden">
            <CodexChips pageId={page.id} systemId={systemId} />
          </div>
        )}
        <div className={cn("tiptap-editor flex-1 relative", writer && "tiptap-writer")}>
          {editor && (
            <BubbleMenu editor={editor}>
              <div className="flex items-center gap-1 bg-popover border border-border rounded-lg px-1.5 py-1 shadow-lg">
                <button
                  type="button"
                  onClick={handleCreateSticky}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                    "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  title="Crear sticky note del texto seleccionado"
                >
                  <StickyNote className="size-3" />
                  Sticky
                </button>
                {writer && <CodexSelectionActions editor={editor} systemId={systemId} />}
              </div>
            </BubbleMenu>
          )}
          {editor && <TableMenus editor={editor} />}
          <div onClickCapture={handleEditorClick}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {writer && (
        <EntityFicheSheet
          entityId={mentionEntityId}
          systemId={systemId}
          open={mentionEntityId !== null}
          onOpenChange={(o) => !o && setMentionEntityId(null)}
        />
      )}

      {stickyCreator !== null && (
        <StickyNoteCreator
          context={{ pageId: resolvedPageId }}
          anchorPoint={stickyCreator.screen}
          textAnchor={stickyCreator.text ?? undefined}
          selectionAnchor={stickyCreator.selectionAnchor ?? undefined}
          onClose={() => setStickyCreator(null)}
        />
      )}
    </>
  );
}
