'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { accountKeys } from './account.hooks';

/**
 * El enlace del correo nuevo vuelve a Ajustes por redirect, así que el
 * resultado llega en la URL y no como respuesta de un fetch. No pinta nada:
 * avisa y refresca la cuenta para que la sección enseñe el correo ya cambiado.
 */
export function EmailChangeResult() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const confirmed = params.get('email') === 'confirmed';

  useEffect(() => {
    if (!confirmed) return;
    toast.success('Correo cambiado y confirmado.');
    qc.invalidateQueries({ queryKey: accountKeys.overview });
  }, [confirmed, qc]);

  return null;
}
