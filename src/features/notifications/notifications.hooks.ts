'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@convex/_generated/api';
import { useConvexAction, useConvexQuery } from '@/shared/convex/hooks';

type PushStatus = 'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported' | 'error';

// En desarrollo next-pwa no registra un worker. Esperar para siempre dejaba
// el interruptor en «Inactivas» y sin respuesta al tocarlo.
async function pushRegistration(): Promise<ServiceWorkerRegistration> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('El service worker no está disponible. Recarga la página e inténtalo de nuevo.')), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function subscriptionData(sub: PushSubscription) {
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.auth || !keys.p256dh) throw new Error('La suscripción del navegador está incompleta. Inténtalo de nuevo.');
  return { endpoint, keys: { auth: keys.auth, p256dh: keys.p256dh } };
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [error, setError] = useState<string | null>(null);
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
      const reg = await pushRegistration();
      const sub = await reg.pushManager.getSubscription();
      // La fila puede haber desaparecido del servidor o pertenecer a otra
      // cuenta. Tener una suscripción local nunca prueba el registro remoto.
      if (sub) await subscribeOnServer(subscriptionData(sub));
      setStatus(sub ? 'subscribed' : 'idle');
      setError(null);
    } catch {
      setStatus('error');
      setError('No se pudo registrar este dispositivo. Recarga la página o vuelve a activar las notificaciones.');
    }
  }, [subscribeOnServer]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  async function subscribe() {
    setStatus('loading');
    setError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error('Las notificaciones push todavía no están configuradas para esta página.');
      // KIN-57: ya no se registra un SW propio aquí. El de next-pwa se registra
      // al cargar la app para todo el mundo (por eso el shell offline existe sin
      // depender del permiso de push) y trae los handlers de `push` desde
      // `worker/index.js`. Aquí sólo se espera a que esté activo.
      // Se pide desde el gesto del botón, antes de esperar al worker.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const reg = await pushRegistration();
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          publicKey
        ),
      });
      await subscribeOnServer(subscriptionData(sub));
      setStatus('subscribed');
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error && !cause.message.includes('CONVEX') ? cause.message : 'No se pudo registrar este dispositivo. Inténtalo de nuevo.');
    }
  }

  async function unsubscribe() {
    try {
      const reg = await pushRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeOnServer({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus('idle');
      setError(null);
    } catch {
      setStatus('error');
      setError('No se pudieron desactivar las notificaciones. Inténtalo de nuevo.');
    }
  }

  return { status, error, subscribe, unsubscribe };
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
        r.push ? `servicio push: ${r.aceptados} de ${r.dispositivos} dispositivo${r.dispositivos === 1 ? '' : 's'}` : null,
        r.correo ? 'correo' : null,
      ].filter(Boolean);
      if (r.fallidos > 0) toast.warning(`Prueba: ${r.aceptados} de ${r.dispositivos} envíos push aceptados; ${r.fallidos} fallaron.${r.caducados ? ' Vuelve a activar las notificaciones en los dispositivos con suscripción caducada.' : ''}${r.correo ? ' Correo enviado.' : ''}`);
      else if (partes.length) toast.success(`Prueba enviada al ${partes.join(' y ')}. Confirma que la ves en cada dispositivo.`);
      else toast.error('La prueba no salió por ningún canal');
    },
    onError: () => toast.error('No se pudo enviar la prueba'),
  });
}
