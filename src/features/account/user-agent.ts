/**
 * Nombre legible del navegador y el sistema a partir del User-Agent que Better
 * Auth guarda con cada sesión. Sirve para que la lista de sesiones diga
 * "Chrome en Android" y no una cadena de ochenta caracteres; no pretende ser
 * un parser completo y cualquier cosa rara cae en "Navegador desconocido".
 */
export interface DeviceDescription {
  browser: string;
  os: string;
  /** Teléfono o tableta, para elegir el icono. */
  mobile: boolean;
}

const UNKNOWN: DeviceDescription = { browser: 'Navegador desconocido', os: '', mobile: false };

function detectOs(ua: string): { os: string; mobile: boolean } {
  if (/iPhone|iPod/.test(ua)) return { os: 'iOS', mobile: true };
  if (/iPad/.test(ua)) return { os: 'iPadOS', mobile: true };
  if (/Android/.test(ua)) return { os: 'Android', mobile: true };
  if (/Windows/.test(ua)) return { os: 'Windows', mobile: false };
  if (/CrOS/.test(ua)) return { os: 'ChromeOS', mobile: false };
  if (/Mac OS X|Macintosh/.test(ua)) return { os: 'macOS', mobile: false };
  if (/Linux/.test(ua)) return { os: 'Linux', mobile: false };
  return { os: '', mobile: false };
}

/** El orden importa: Edge, Opera y Chrome iOS se anuncian también como Chrome o Safari. */
function detectBrowser(ua: string): string | null {
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return null;
}

export function describeUserAgent(userAgent: string | null | undefined): DeviceDescription {
  if (!userAgent) return UNKNOWN;
  const browser = detectBrowser(userAgent);
  const { os, mobile } = detectOs(userAgent);
  if (!browser && !os) return UNKNOWN;
  return { browser: browser ?? 'Navegador desconocido', os, mobile };
}
