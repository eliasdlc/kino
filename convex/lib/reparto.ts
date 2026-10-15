import type { Id } from '../_generated/dataModel';
import type { AvisoDeTarea, Entrega } from '../notifications';
import { PRIORITY_RANK } from '../../src/shared/lib/effective-priority';
import { textoResumen, type Resumen } from './recordatorios';

// Cómo se reparte una tanda de avisos a una persona, sin saber nada de web-push,
// de Resend ni de Convex. Vive aparte de la acción que envía para poder probar
// lo que importa: que varias tareas salen en un solo push, que lo que no salió
// no se marca como avisado, y que el correo entra cuando el push no llega.

export interface Payload {
  title: string;
  body: string;
  url?: string;
  /** Mismo `tag`, misma notificación: un aviso nuevo de una tarea sustituye al anterior. */
  tag?: string;
  /** Los botones «Hecha» y «En 1 h». Sólo cuando el aviso es de una sola tarea. */
  accion?: { endpoint: string; token: string };
}

export interface Correo {
  asunto: string;
  texto: string;
  html: string;
}

export interface Canales {
  /** Un push a todos los dispositivos. `intentos` es cuántos tenía registrados. */
  push: (payload: Payload) => Promise<{ intentos: number; entregado: boolean }>;
  /** `null` cuando el deployment no puede mandar correo. */
  correo: ((correo: Correo) => Promise<boolean>) | null;
  /** El enlace firmado de los botones de una tarea, o `null` si no se puede firmar. */
  firmar: (taskId: Id<'tasks'>) => Promise<{ endpoint: string; token: string } | null>;
  /** URL absoluta de la app, para los enlaces del correo. */
  appUrl: string;
}

/**
 * Tope de correos de respaldo por persona y día. El resumen de la mañana no
 * cuenta. Con la intensidad agresiva una vencida insiste cada tres horas, y
 * sin tope una persona sin push recibiría un correo por cada una.
 */
export const TOPE_CORREOS_DIA = 6;

export interface Registro {
  avisados: Id<'tasks'>[];
  reintentar: Id<'tasks'>[];
  recordatorios: Id<'taskReminders'>[];
  correos: number;
}

const enlaceTarea = (taskId: string) => `/tasks?tarea=${taskId}`;

/** Lo vencido primero, después lo más urgente. */
function ordenar(avisos: AvisoDeTarea[]): AvisoDeTarea[] {
  return [...avisos].sort(
    (a, b) => Number(b.vencida) - Number(a.vencida) || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
  );
}

/**
 * El push de los avisos de una vuelta. Una tarea: su estado de título y su
 * nombre de cuerpo, que es lo que se lee con la pantalla bloqueada. Varias: la
 * cifra, y las tres primeras con su estado.
 */
export function avisosPayload(avisos: AvisoDeTarea[]): Payload {
  const ordenados = ordenar(avisos);
  if (ordenados.length === 1) {
    const [a] = ordenados;
    return { title: a!.texto, body: a!.title, url: enlaceTarea(a!.taskId), tag: `tarea-${a!.taskId}` };
  }
  const n = ordenados.length;
  const vencidas = ordenados.filter((a) => a.vencida).length;
  const lineas = ordenados.slice(0, 3).map((a) => `${a.texto}: ${a.title}`);
  const resto = n - lineas.length;
  return {
    title: vencidas ? `${n} tareas sin terminar · ${vencidas} vencida${vencidas > 1 ? 's' : ''}` : `${n} tareas sin terminar`,
    body: lineas.join(' · ') + (resto > 0 ? ` y ${resto} más` : ''),
    url: '/tasks',
    tag: 'avisos',
  };
}

export function resumenPayload(r: Resumen): Payload {
  return { ...textoResumen(r), url: '/dashboard', tag: 'resumen' };
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function listaHtml(titulo: string, items: Array<{ id: string; title: string; detalle?: string }>, appUrl: string): string {
  if (items.length === 0) return '';
  const filas = items
    .map(
      (t) =>
        `<li style="margin:4px 0"><a href="${escapar(appUrl + enlaceTarea(t.id))}" style="color:#111">${escapar(t.title)}</a>${
          t.detalle ? ` <span style="color:#666">· ${escapar(t.detalle)}</span>` : ''
        }</li>`,
    )
    .join('');
  return `<h3 style="font-size:14px;margin:16px 0 4px">${escapar(titulo)}</h3><ul style="padding-left:18px;margin:0">${filas}</ul>`;
}

function listaTexto(titulo: string, items: Array<{ title: string; detalle?: string }>): string {
  if (items.length === 0) return '';
  return `${titulo}\n${items.map((t) => `- ${t.title}${t.detalle ? ` (${t.detalle})` : ''}`).join('\n')}\n`;
}

function envolver(cuerpo: string, appUrl: string): string {
  return `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;max-width:520px">${cuerpo}<p style="margin-top:24px;color:#666;font-size:12px">Cambia cuánto insisten los avisos en <a href="${escapar(
    `${appUrl}/settings`,
  )}" style="color:#666">Ajustes</a>.</p></div>`;
}

export function correoResumen(r: Resumen, appUrl: string): Correo {
  const { title } = textoResumen(r);
  const secciones = [
    { titulo: 'Vencidas', items: r.vencidas },
    { titulo: 'Para hoy', items: r.hoy },
    { titulo: 'Para mañana', items: r.manana },
    { titulo: 'En los próximos días', items: r.proximas.map((t) => ({ ...t, detalle: `en ${t.dias} días` })) },
  ];
  return {
    asunto: `Tu día: ${title}`,
    texto: secciones.map((s) => listaTexto(s.titulo, s.items)).filter(Boolean).join('\n'),
    html: envolver(secciones.map((s) => listaHtml(s.titulo, s.items, appUrl)).join(''), appUrl),
  };
}

export function correoAvisos(
  avisos: AvisoDeTarea[],
  recordatorios: Entrega['recordatorios'],
  appUrl: string,
): Correo {
  const items = [
    ...ordenar(avisos).map((a) => ({ id: a.taskId, title: a.title, detalle: a.texto })),
    ...recordatorios.map((r) => ({ id: r.taskId, title: r.taskTitle, detalle: r.label ?? 'Recordatorio' })),
  ];
  const asunto = items.length === 1 ? `${items[0]!.detalle}: ${items[0]!.title}` : `${items.length} tareas sin terminar`;
  return {
    asunto,
    texto: listaTexto('Sin terminar', items),
    html: envolver(listaHtml('Sin terminar', items, appUrl), appUrl),
  };
}

/**
 * Reparte la tanda de una persona y devuelve **sólo lo que se entregó**.
 *
 * El orden de canales: push primero, porque es inmediato y no gasta cuota. Si
 * ningún dispositivo lo recibe, el correo, con su tope diario. Un aviso sin
 * ningún canal posible avanza igual a su siguiente punto (reintentar no lo
 * haría llegar); uno que tenía canal y falló se reintenta.
 */
export async function repartir(entrega: Entrega, canales: Canales): Promise<{ registro: Registro; notified: number }> {
  const registro: Registro = { avisados: [], reintentar: [], recordatorios: [], correos: 0 };
  let notified = 0;
  const correo = entrega.correo ? canales.correo : null;
  const quedanCorreos = () => entrega.correosHoy + registro.correos < TOPE_CORREOS_DIA;

  if (entrega.resumen) {
    const push = await canales.push(resumenPayload(entrega.resumen));
    if (push.entregado) notified += 1;
    // El resumen va siempre también por correo: es el aviso del día y no gasta
    // del tope de respaldo.
    if (correo && (await correo(correoResumen(entrega.resumen, canales.appUrl)))) notified += 1;
  }

  const sinCorreo: Entrega['recordatorios'] = [];
  for (const r of entrega.recordatorios) {
    const accion = (await canales.firmar(r.taskId)) ?? undefined;
    const push = await canales.push({ title: r.label ?? 'Recordatorio', body: r.taskTitle, url: enlaceTarea(r.taskId), tag: `tarea-${r.taskId}`, accion });
    if (push.entregado) {
      registro.recordatorios.push(r.id);
      notified += 1;
    } else if (push.intentos === 0 && !correo) {
      // Sin ningún canal posible: se da por visto para no releerlo cada vuelta.
      registro.recordatorios.push(r.id);
    } else {
      sinCorreo.push(r);
    }
  }

  let avisosPendientes: AvisoDeTarea[] = [];
  if (entrega.avisos.length) {
    const payload = avisosPayload(entrega.avisos);
    if (entrega.avisos.length === 1) payload.accion = (await canales.firmar(entrega.avisos[0]!.taskId)) ?? undefined;
    const push = await canales.push(payload);
    if (push.entregado) {
      registro.avisados.push(...entrega.avisos.map((a) => a.taskId));
      notified += entrega.avisos.length;
    } else if (push.intentos === 0 && !correo) {
      registro.avisados.push(...entrega.avisos.map((a) => a.taskId));
    } else {
      avisosPendientes = entrega.avisos;
    }
  }

  if (avisosPendientes.length || sinCorreo.length) {
    const enviado = correo && quedanCorreos() ? await correo(correoAvisos(avisosPendientes, sinCorreo, canales.appUrl)) : false;
    if (enviado) {
      registro.correos += 1;
      registro.avisados.push(...avisosPendientes.map((a) => a.taskId));
      registro.recordatorios.push(...sinCorreo.map((r) => r.id));
      notified += avisosPendientes.length + sinCorreo.length;
    } else {
      registro.reintentar.push(...avisosPendientes.map((a) => a.taskId));
      // Los recordatorios sin enviar se quedan como están: el índice los
      // vuelve a traer en la próxima vuelta.
    }
  }

  return { registro, notified };
}
