import type { Correo } from './reparto';

// El correo de los recordatorios, por la API HTTP de Resend y sin SDK: un
// `fetch` y nada más. El plan gratuito da 100 correos al día y 3.000 al mes,
// que con el resumen diario y el tope de respaldo (`TOPE_CORREOS_DIA`) cabe de
// sobra para las cuentas de hoy.
//
// Inerte sin `RESEND_API_KEY` y `RESEND_FROM` en el deployment: los avisos
// siguen saliendo por push, y el cron lo dice en su log.

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

/**
 * Lo que pasó con un correo. `rechazado` es un veredicto de Resend sobre esta
 * persona que no se arregla insistiendo, y son sólo dos: la dirección inválida
 * (422 `validation_error`) y el destinatario que el remitente de pruebas no
 * admite (403 `validation_error`, «sólo puedes enviar a tu propio correo»: con
 * `onboarding@resend.dev` Resend sólo escribe al dueño de la cuenta).
 *
 * Todo lo demás es `fallo` y se reintenta, y es a propósito el lado ancho. Una
 * clave mala (400 o 401 `validation_error`), restringida o suspendida, un
 * dominio sin verificar, un cuerpo de petición roto o un mensaje que Resend
 * cambie mañana son fallos de la cuenta entera: darlos por perdidos haría
 * avanzar en silencio el aviso de todo el mundo, y reintentarlos hace ruido.
 * Probado contra Resend el 17 de octubre de 2026 con la clave real; la lista de
 * errores es https://resend.com/docs/api-reference/errors.
 */
export type EnvioCorreo = 'enviado' | 'rechazado' | 'fallo';

/** Nunca lanza: un correo fallido es un canal menos, no un cron roto. */
export async function enviarCorreo(para: string, correo: Correo): Promise<EnvioCorreo> {
  const clave = process.env.RESEND_API_KEY;
  const de = process.env.RESEND_FROM;
  if (!clave || !de) return 'fallo';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: de, to: [para], subject: correo.asunto, text: correo.texto, html: correo.html }),
    });
    if (res.ok) return 'enviado';
    const cuerpo: unknown = await res.json().catch(() => null);
    const campo = (k: string) => (cuerpo && typeof cuerpo === 'object' && k in cuerpo ? String((cuerpo as Record<string, unknown>)[k]) : '');
    const nombre = campo('name') || 'sin cuerpo';
    console.warn(`[avisos] Resend no aceptó el correo (${res.status}, ${nombre})`);
    const validacion = nombre === 'validation_error';
    const direccionInvalida = res.status === 422 && validacion;
    const soloAlDueno = res.status === 403 && validacion && /your own email address/i.test(campo('message'));
    return direccionInvalida || soloAlDueno ? 'rechazado' : 'fallo';
  } catch {
    console.warn('[avisos] Resend no respondió');
    return 'fallo';
  }
}
