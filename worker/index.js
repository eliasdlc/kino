/**
 * Custom worker de next-pwa (KIN-57).
 *
 * next-pwa compila este archivo y lo importa dentro del `sw.js` que genera, así
 * que es el único sitio donde vive código de service worker escrito a mano.
 * Contiene lo que antes estaba en `public/kino-sw.js` y no cubre Workbox: la
 * recepción de notificaciones push, el foco de ventana al pulsarlas, y el
 * destino de compartir.
 *
 * Lo que NO va aquí: precache del shell, fallback de `/offline` y estrategias de
 * red. De eso se encarga la configuración de next-pwa en `next.config.ts`.
 *
 * Dos avisos que nadie debería deshacer:
 *  - el handler del destino de compartir tiene que estar registrado aquí, junto
 *    a los de push, porque este es el único worker que existe;
 *  - el plugin de PWA es de **webpack**, así que sin `pnpm build` (que ya lleva
 *    `--webpack`) el service worker no se emite y el build sale verde igual.
 */

import { atenderCompartido, guardarEnCola, leerDueno } from '@/features/captures/shareTarget';

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Kino', {
      body: data.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: data.url ?? '/dashboard' },
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        const url = event.notification.data?.url ?? '/dashboard';
        for (const client of list) {
          if (client.url.includes(url) && 'focus' in client) return client.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});

/**
 * El POST de la hoja de compartir. Se responde aquí y antes de la red: la
 * cookie de sesión es `Lax` y no viaja en un POST cross-site, así que dejarlo
 * llegar al servidor termina en un redirect a login que se come el cuerpo
 * multipart. Lo compartido se guarda y se contesta con un redirect a GET.
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/compartir') return;

  event.respondWith(
    atenderCompartido(event.request, {
      guardar: guardarEnCola,
      duenoActual: leerDueno,
      nuevoId: () => crypto.randomUUID(),
      ahora: () => Date.now(),
    }).catch(
      () =>
        // Nunca la pantalla de error de la app: aquí hay que decir dónde quedó
        // lo compartido, y sólo esta ruta puede decirlo.
        new Response(null, { status: 303, headers: { Location: '/compartir?fallo=1' } })
    )
  );
});
