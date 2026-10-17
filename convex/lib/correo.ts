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
 * Lo que pasó con un correo. `rechazado` es el `validation_error` de Resend, que
 * es un veredicto sobre este correo y no se arregla insistiendo: un remitente de
 * un dominio sin verificar (con `onboarding@resend.dev` sólo se puede escribir
 * al dueño de la cuenta), una dirección inválida. Todo lo demás es `fallo` y se
 * reintenta: lo pasajero (ritmo, servidor, red) y también una clave revocada o
 * restringida, porque eso es un fallo de configuración de toda la cuenta, y
 * darlo por perdido haría avanzar en silencio el aviso de todo el mundo.
 *
 * Hace falta el código y el nombre a la vez. Probado contra Resend el 17 de
 * octubre de 2026: el dominio sin verificar y el destinatario no admitido dan
 * 403 `validation_error`, la dirección inválida 422 `validation_error`, y una
 * clave inválida 401 `validation_error` también.
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
    const nombre = cuerpo && typeof cuerpo === 'object' && 'name' in cuerpo ? String(cuerpo.name) : 'sin cuerpo';
    console.warn(`[avisos] Resend rechazó el correo (${res.status}, ${nombre})`);
    return res.status !== 401 && nombre === 'validation_error' ? 'rechazado' : 'fallo';
  } catch {
    console.warn('[avisos] Resend no respondió');
    return 'fallo';
  }
}
