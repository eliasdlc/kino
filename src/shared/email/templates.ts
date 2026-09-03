import type { EmailMessage } from "./send";

/**
 * Plantilla base de los correos transaccionales: la misma identidad oscura del
 * sitio de marketing (fondo #0e0e11, tarjeta #18181c, acento índigo), sobria y
 * sin imágenes. Todo inline porque los clientes de correo ignoran <style>.
 */

const ACCENT = "#818cf8";

interface TransactionalEmail {
  subject: string;
  heading: string;
  /** Frase corta bajo el título que explica por qué llega este correo. */
  intro: string;
  ctaLabel: string;
  url: string;
  /** Cierre en letra pequeña: caducidad y qué hacer si no lo pediste. */
  footnote: string;
}

function render(to: string, email: TransactionalEmail): EmailMessage {
  const { subject, heading, intro, ctaLabel, url, footnote } = email;

  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#0e0e11;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0e0e11;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
            <tr>
              <td style="padding:0 4px 18px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#f4f4f5;">
                kino
              </td>
            </tr>
            <tr>
              <td style="background-color:#18181c;border:1px solid rgba(255,255,255,0.09);border-radius:20px;padding:32px 28px;">
                <h1 style="margin:0 0 10px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.25;letter-spacing:-0.02em;color:#f4f4f5;">
                  ${heading}
                </h1>
                <p style="margin:0 0 24px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#a1a1aa;">
                  ${intro}
                </p>
                <a href="${url}" style="display:inline-block;background-color:${ACCENT};color:#0e0e11;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:12px;">
                  ${ctaLabel}
                </a>
                <p style="margin:24px 0 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.55;color:#6b6b74;">
                  ${footnote}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 4px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#52525b;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
                <a href="${url}" style="color:${ACCENT};word-break:break-all;">${url}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${heading}\n\n${intro}\n\n${ctaLabel}: ${url}\n\n${footnote}`;

  return { to, subject, html, text };
}

export function resetPasswordEmail(to: string, url: string): EmailMessage {
  return render(to, {
    subject: "Restablece tu contraseña de Kino",
    heading: "Restablece tu contraseña",
    intro:
      "Alguien pidió restablecer la contraseña de esta cuenta. Si fuiste tú, entra por el botón y elige una nueva.",
    ctaLabel: "Elegir contraseña nueva",
    url,
    footnote:
      "El enlace sirve una sola vez y caduca en una hora. Si no lo pediste, ignora este correo: tu contraseña sigue igual.",
  });
}

export function verifyEmailEmail(to: string, url: string): EmailMessage {
  return render(to, {
    subject: "Confirma tu correo en Kino",
    heading: "Confirma tu correo",
    intro:
      "Con el correo confirmado, tu cuenta se puede recuperar si un día olvidas la contraseña.",
    ctaLabel: "Confirmar correo",
    url,
    footnote:
      "El enlace caduca en una hora; desde la app puedes pedir otro. Si no creaste una cuenta en Kino, ignora este correo.",
  });
}

export function changeEmailEmail(to: string, url: string): EmailMessage {
  return render(to, {
    subject: "Confirma tu correo nuevo en Kino",
    heading: "Confirma tu correo nuevo",
    intro:
      "Pediste cambiar el correo de tu cuenta de Kino a esta dirección. El cambio se aplica al confirmarlo; hasta entonces sigues entrando con el correo anterior.",
    ctaLabel: "Confirmar correo nuevo",
    url,
    footnote:
      "El enlace caduca en una hora. Si no pediste este cambio, ignora este correo: tu cuenta sigue con el correo de siempre.",
  });
}
