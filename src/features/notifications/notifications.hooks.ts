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

/** ¿La suscripción se creó con una clave pública distinta de la que firma hoy? */
function otraClave(sub: PushSubscription, publicKey: string): boolean {
  const suya = sub.options?.applicationServerKey;
  if (!suya) return false;
  const actual = urlBase64ToUint8Array(publicKey);
  const bytes = new Uint8Array(suya);
  return bytes.length !== actual.length || bytes.some((b, i) => b !== actual[i]);
}

/** Lo que el servidor necesita saber de una suscripción. */
interface Servidor {
  registrar: (data: ReturnType<typeof subscriptionData>) => Promise<unknown>;
  olvidar: (args: { endpoint: string }) => Promise<unknown>;
}

/**
 * Este navegador puede recibir push. Se mira `Notification` además de
 * `PushManager` porque leer `Notification.permission` donde no existe lanza.
 */
function pushSoportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

/**
 * Una suscripción hecha con otra clave VAPID no recibe nada: el servicio push
 * la rechaza y el servidor la retira. Se borra del servidor, se deshace aquí y
 * se crea otra con la clave actual. Sin suscripción, devuelve null.
 */
async function conClaveActual(
  reg: ServiceWorkerRegistration,
  sub: PushSubscription | null,
  publicKey: string,
  olvidar: Servidor['olvidar'],
): Promise<PushSubscription | null> {
  if (!sub || !otraClave(sub, publicKey)) return sub;
  await olvidar({ endpoint: sub.endpoint });
  await sub.unsubscribe();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
}

let enCurso: Promise<PushSubscription | null> | null = null;

/**
 * Deja la suscripción de este navegador viva y registrada en el servidor, sin
 * pedir permiso: quien la llama ya comprobó que está concedido. Dos llamadas a
 * la vez (la app y Ajustes al abrirse juntas) comparten la misma operación,
 * porque dos rehaciendo la misma suscripción se deshacen la una a la otra.
 */
function mantenerSuscripcion(servidor: Servidor): Promise<PushSubscription | null> {
  enCurso ??= (async () => {
    const reg = await pushRegistration();
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    let sub = await reg.pushManager.getSubscription();
    if (publicKey) sub = await conClaveActual(reg, sub, publicKey, servidor.olvidar);
    if (sub) await servidor.registrar(subscriptionData(sub));
    return sub;
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const subscribeOnServer = useMutation(api.notifications.subscribe);
  const unsubscribeOnServer = useMutation(api.notifications.unsubscribe);

  const checkSubscription = useCallback(async () => {
    if (!pushSoportado()) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    try {
      // La fila puede haber desaparecido del servidor o pertenecer a otra
      // cuenta. Tener una suscripción local nunca prueba el registro remoto.
      const sub = Notification.permission === 'granted'
        ? await mantenerSuscripcion({ registrar: subscribeOnServer, olvidar: unsubscribeOnServer })
        : null;
      setStatus(sub ? 'subscribed' : 'idle');
      setError(null);
    } catch {
      setStatus('error');
      setError('No se pudo registrar este dispositivo. Recarga la página o vuelve a activar las notificaciones.');
    }
  }, [subscribeOnServer, unsubscribeOnServer]);

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
      const sub = (await conClaveActual(reg, await reg.pushManager.getSubscription(), publicKey, unsubscribeOnServer))
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
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

const MANTENIDA = 'kino-push-mantenida';

/**
 * Lo que la app hace al abrirse, en cualquier pantalla: si este dispositivo ya
 * dio permiso, revisa su suscripción una vez por sesión del navegador. Así un
 * teléfono que se registró una vez no deja de recibir aunque nadie vuelva a
 * Ajustes. Nunca pide permiso: eso sólo puede salir de un toque.
 */
export function useMantenerAvisos() {
  const registrar = useMutation(api.notifications.subscribe);
  const olvidar = useMutation(api.notifications.unsubscribe);
  useEffect(() => {
    if (!pushSoportado() || Notification.permission !== 'granted' || sessionStorage.getItem(MANTENIDA)) return;
    sessionStorage.setItem(MANTENIDA, '1');
    mantenerSuscripcion({ registrar, olvidar }).catch(() => sessionStorage.removeItem(MANTENIDA));
  }, [registrar, olvidar]);
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
