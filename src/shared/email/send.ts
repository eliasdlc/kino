/**
 * Único punto de salida de correo de la app. Habla con la API REST de Resend
 * directamente (un solo POST) en vez de cargar un SDK para un endpoint.
 *
 * Sin `RESEND_API_KEY` el correo no sale pero el flujo que lo pidió sigue:
 * en desarrollo se imprime completo en consola para poder ejercitar
 * recuperación y verificación sin cuenta del proveedor; en producción se
 * deja un aviso en el log, así un registro nunca falla por falta de proveedor.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Remitente por defecto: el dominio de pruebas de Resend hasta verificar uno propio. */
const DEFAULT_FROM = "Kino <onboarding@resend.dev>";

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `[email] RESEND_API_KEY no está configurada: correo omitido to=${message.to} subject="${message.subject}"`,
      );
      return;
    }
    console.info(
      `[email:dev] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
    return;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend respondió ${res.status}: ${detail}`);
  }
}
