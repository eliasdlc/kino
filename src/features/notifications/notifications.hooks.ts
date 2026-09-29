'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@convex/_generated/api';
import { useConvexAction, useConvexQuery } from '@/shared/convex/hooks';

type PushStatus = 'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('idle');
  const subscribeOnServer = useMutation(api.notifications.subscribe);
  const unsubscribeOnServer = useMutation(api.notifications.unsubscribe);

  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'subscribed' : 'idle');
    } catch {
      setStatus('idle');
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  async function subscribe() {
    setStatus('loading');
    try {
      // KIN-57: ya no se registra un SW propio aquí. El de next-pwa se registra
      // al cargar la app para todo el mundo (por eso el shell offline existe sin
      // depender del permiso de push) y trae los handlers de `push` desde
      // `worker/index.js`. Aquí sólo se espera a que esté activo.
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { auth: string; p256dh: string };
      };
      await subscribeOnServer({ endpoint: json.endpoint, keys: json.keys });
      setStatus('subscribed');
    } catch {
      await checkSubscription();
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeOnServer({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
    } finally {
      setStatus('idle');
    }
  }

  return { status, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Lo que el servidor sabe de los avisos: cuántos dispositivos tienen push
 * registrado y si el deployment puede mandar push y correo. Ajustes lo enseña
 * en vez de fiarse sólo de lo que dice este navegador.
 */
export function useEstadoAvisos() {
  return useConvexQuery(api.notifications.estado, {});
}

/** «Enviar una prueba»: un push a cada dispositivo y un correo, con el resultado de cada canal. */
export function useProbarAvisos() {
  return useConvexAction(api.notifications.probar, {
    onSuccess: (r) => {
      const partes = [
        r.push ? `push en ${r.dispositivos} dispositivo${r.dispositivos === 1 ? '' : 's'}` : null,
        r.correo ? 'correo' : null,
      ].filter(Boolean);
      if (partes.length) toast.success(`Prueba enviada: ${partes.join(' y ')}`);
      else toast.error('La prueba no salió por ningún canal');
    },
    onError: () => toast.error('No se pudo enviar la prueba'),
  });
}
