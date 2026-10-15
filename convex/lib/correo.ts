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

/** `true` si Resend aceptó el correo. Nunca lanza: un correo fallido es un canal menos, no un cron roto. */
export async function enviarCorreo(para: string, correo: Correo): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  const de = process.env.RESEND_FROM;
  if (!clave || !de) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: de, to: [para], subject: correo.asunto, text: correo.texto, html: correo.html }),
    });
    if (!res.ok) console.warn(`[avisos] Resend rechazó el correo (${res.status})`);
    return res.ok;
  } catch {
    console.warn('[avisos] Resend no respondió');
    return false;
  }
}
