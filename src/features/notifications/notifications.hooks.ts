'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';

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
