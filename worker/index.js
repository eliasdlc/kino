/**
 * Custom worker de next-pwa (KIN-57).
 *
 * next-pwa compila este archivo y lo importa dentro del `sw.js` que genera, así
 * que es el único sitio donde vive código de service worker escrito a mano.
 * Contiene lo que antes estaba en `public/kino-sw.js` y no cubre Workbox: la
 * recepción de notificaciones push y el foco de ventana al pulsarlas.
 *
 * Lo que NO va aquí: precache del shell, fallback de `/offline` y estrategias de
 * red. De eso se encarga la configuración de next-pwa en `next.config.ts`.
 */

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
