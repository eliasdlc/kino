'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@convex/_generated/api';
import type { VocabularyWord } from '@convex/schema';
import { useConvexMutation } from '@/shared/convex/hooks';
import { useUserSettings } from './settings.hooks';

export type { VocabularyWord };

/**
 * La puerta de una palabra del producto: aparece cuando haces el gesto que la
 * significa, y aparece **una vez**.
 *
 * La regla que sostiene esto es el principio 7: Kino pregunta una vez y luego
 * observa. Si la ignoras, no se insiste, porque insistir sería un tercer empuje
 * del sistema y el producto tiene dos.
 *
 * Se marca al **enseñarla**, no al aceptarla: haberla visto ya es haberla visto.
 * Y una vez abierta se queda abierta mientras el gesto siga vigente, aunque el
 * servidor ya la haya marcado, o desaparecería a media frase.
 *
 * @param word la palabra que esta puerta enseña
 * @param gesture si el gesto que la justifica está ocurriendo ahora mismo
 */
export function useWordGate(word: VocabularyWord, gesture: boolean): boolean {
  const { data: settings } = useUserSettings();
  const { mutate: markSeen } = useConvexMutation(api.settings.markWordSeen);
  const [opened, setOpened] = useState(false);
  const marked = useRef(false);

  // La primera vez que el gesto ocurre y la palabra no se ha enseñado nunca.
  // Se ajusta durante el render y no dentro de un efecto: el efecto abriría la
  // puerta un render tarde, y para entonces el servidor ya la marcó vista y
  // `firstTime` sería falso.
  const firstTime = settings !== undefined && !settings.wordsSeen.includes(word);
  if (gesture && firstTime && !opened) setOpened(true);

  useEffect(() => {
    if (!opened || marked.current) return;
    marked.current = true;
    markSeen({ word });
  }, [opened, markSeen, word]);

  return opened && gesture;
}
