'use client';

import { useMantenerAvisos } from './notifications.hooks';

/** Mantiene viva la suscripción push de este dispositivo. No pinta nada. */
export function MantenerAvisos() {
  useMantenerAvisos();
  return null;
}
