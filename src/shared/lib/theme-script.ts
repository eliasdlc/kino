/**
 * Scripts inline que aplican la clase `dark` antes de la primera pintura.
 *
 * El tema vive en `localStorage` (elección de este dispositivo) con la cuenta
 * como respaldo. Aplicarlo desde React siempre llega tarde: `useEffect` corre
 * después de pintar, así que el navegador alcanza a mostrar un frame claro.
 * Un script síncrono en el HTML se ejecuta mientras el documento se parsea,
 * antes de que haya nada que pintar.
 *
 * Ninguno de los dos escribe en `localStorage`: sólo leen y aplican la clase.
 * De persistir se encarga `ThemeProvider`, que es quien conoce la intención
 * del usuario.
 */

const STORAGE_KEY = "kino-theme";

/**
 * Va en el `<head>` del layout raíz. Cubre el caso normal: el dispositivo ya
 * eligió tema alguna vez. Si no hay nada guardado, cae a la preferencia del
 * sistema, que es también el default de la cuenta.
 */
export const rootThemeScript = `(function(){try{
var m=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
if(m!=="light"&&m!=="dark"&&m!=="system")m="system";
var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
}catch(e){}})()`;

/**
 * Va dentro del layout de `(app)`, que es el único que conoce la cuenta.
 * Sólo actúa en un dispositivo estrenado, donde `localStorage` está vacío y
 * el script del raíz no tuvo con qué decidir: sin esto, quien tiene la cuenta
 * en Claro y el sistema en Oscuro entra en oscuro y salta al hidratar.
 *
 * Corre mientras el HTML todavía se transmite, así que sigue estando antes de
 * la primera pintura.
 */
export function accountThemeScript(theme: "light" | "dark" | "system"): string {
  return `(function(){try{
if(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))return;
var m=${JSON.stringify(theme)};
var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
}catch(e){}})()`;
}
